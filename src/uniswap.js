require('./bootstrap')

const moment = require('moment')
const mysql = require('mysql')
const { post } = require('axios')

const TIMESTAMP_FORMAT = "YYYY-MM-DD HH:mm:ss"
const WAS_AT_FORMAT = "YYYY-MM-DD"
const db = mysql.createConnection({
    host:     process.env.DB_HOST,
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
})
let tokenList

const fetchData = async (token, from, to) => {
    const query = `
{
  tokenDayDatas (
      where:{
        token:"${token}",
        date_gte:${from}
        date_lt:${to}
      }
  ) {
    date
    dailyVolumeUSD
    priceUSD
  }
}
    `
    try {
        const { data } = await post('https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v2', {query})
        return data.data.tokenDayDatas
    } catch (e) {
        console.error(`[${token}] Fails to fetch data.`)
        return false
    }
}

const getData = async (address, from, to) => {
    const MAX_ATTEMPTS = 10
    let i = 0

    while (i < MAX_ATTEMPTS) {
        if (i) {
            console.log(`${address.toUpperCase()} fail. Restart attempt:`, i)
        }
        const response = await fetchData(address, from, to)
        if (!!response) {
            return response
        }
        i++
    }

    throw `${address}: Can't get prices!`
}

const storeData = (token_id, data) => {
    const created_at = moment().format(TIMESTAMP_FORMAT)
    const was_at = moment(data.date * 1000).format(WAS_AT_FORMAT)
    const sql =
        "INSERT INTO uniswap_daily (token_id, price_usd, volume, was_at, created_at) VALUES "
        + `(${token_id}, ${data.priceUSD}, ${data.dailyVolumeUSD}, '${was_at}', '${created_at}')`
    db.query(sql, function (err) {
        if (err) {
            throw err
        }
    });
}

const getTokenHistoricalPrices = async (token_id, address) => {
    const start = moment()
    let month = 0
    let fetchPrices = true
    while (fetchPrices) {
        console.log(`[${address}] Months from now:`, month)
        let to = moment().subtract(month, 'months')
        let from = moment().subtract(month + 1, 'months')
        try {
            const prices = await getData(address, from.unix() , to.unix())
            if (prices.length) {
                prices.forEach(tokenData => {
                    storeData(token_id, tokenData)
                })
                month++
            } else {
                fetchPrices = false
            }
        } catch (e) {
            console.log(e)
            fetchPrices = false
        }
    }
    console.log(`${address} finished in`, start.fromNow(true))
}

const getTokensList = async () => {
    return new Promise((resolve, reject) => {
        db.query("SELECT * FROM tokens", ((err, result) => {
            resolve(result)
        }))
    })
}

const init = async () => {
    await getTokensList().then(async tokens => {
        for (let i in tokens) {
            const token = tokens[i]
            await getTokenHistoricalPrices(token.id, token.address)
        }
    })
}

init().then(() => process.exit())

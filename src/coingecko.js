require('./bootstrap')

const moment = require('moment')
const { get } = require('axios')
const mysql = require('mysql')

const TIMESTAMP_FORMAT = "YYYY-MM-DD HH:mm:ss"
const db = mysql.createConnection({
    host:     process.env.DB_HOST,
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
})
let coingecko_ids
let tokensList

const fetchCoingeckoIDs = async () => {
    console.log('Fetching Coingecko IDs.')
    try {
        const { data } = await get('https://api.coingecko.com/api/v3/coins/list')
        coingecko_ids = data
        console.log('Coingecko IDs fetched successfully.')
    } catch (exception) {
        throw `Can't get CoinGecko tokens IDs: ${exception}`
    }
}

const getCoingeckoID = symbol => {
    const tokenInfo = coingecko_ids.find(token => token.symbol === symbol.toLowerCase())
    try {
        return tokenInfo.id
    } catch (e) {
        console.log(`Can't find CoinGecko ID for token ${symbol.toUpperCase()}`)
        return false
    }
}

const fetchData = async (id, from, to) => {
    const url =
        `https://api.coingecko.com/api/v3/coins/${id}/market_chart/range?vs_currency=usd&from=${from}&to=${to}`

    try {
        const { data } = await get(url)
        return data
    } catch (e) {
        return false
    }
}

const getData = async (symbol, from, to) => {
    const MAX_ATTEMPTS = 10
    let i = 0

    while (i < MAX_ATTEMPTS) {
        if (i) {
            console.log(`${symbol.toUpperCase()} fail. Restart attempt:`, i)
        }
        const response = await fetchData(symbol, from, to)
        if (!!response) {
            return response
        }
        i++
    }

    throw `${symbol}: Can't get prices!`
}

const storeData = (token_id, time, price, volume) => {
    const created_at = moment().format(TIMESTAMP_FORMAT)
    const was_at = moment(time).format(TIMESTAMP_FORMAT)
    const sql =
        "INSERT INTO coingecko_hourly (token_id, price_usd, volume, was_at, created_at) "
        + `VALUES (${token_id}, ${price}, ${volume}, '${was_at}', '${created_at}')`
    db.query(sql, function (err) {
        if (err) {
            throw err
        }
    });
}

const formatData = data => {
    if (!data.hasOwnProperty('prices')) {
        throw 'Wrong data!'
    }
    let length = data.prices.length
    for (let i = 0; i < length; i++) {
        data.prices[i].push(data["total_volumes"][i][1])
    }
    return data.prices
}

const getTokenHistoricalPrices = async (id, symbol) => {
    const start = moment()
    const coingeckoID = getCoingeckoID(symbol)
    if (!!coingeckoID) {
        let month = 0
        let fetchPrices = true
        while (fetchPrices) {
            console.log(`[${symbol.toUpperCase()}] Months from now:`, month)
            let to = moment().subtract(month, 'months')
            let from = moment().subtract(month + 1, 'months')
            try {
                let formattedData = formatData(await getData(coingeckoID, from.unix() , to.unix()))
                if (formattedData.length) {
                    formattedData.forEach(tokenData => {
                        storeData(id, ...tokenData)
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
        console.log(`${symbol.toUpperCase()} finished in`, start.fromNow(true))
    }
}

const getTokensList = async () => {
    await db.query("SELECT * FROM tokens", function (err, result) {
        if (err) throw {
            err
        }
        tokensList = result
    })
}

const init = async () => {
    await getTokensList()
    await fetchCoingeckoIDs()
    for (const num in tokensList) {
        const token = tokensList[num]
        await getTokenHistoricalPrices(token.id, token.symbol)
    }

}

init().then(() => console.log('Done.'))

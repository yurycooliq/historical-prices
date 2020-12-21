require('./bootstrap')

const mysql = require('mysql')
const tokensList = require('./../assets/tokens.json')

const MAX_TOKENS = 100
const tokens = []

const db = mysql.createConnection({
    host:     process.env.DB_HOST,
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
})

const getTokens = () => {
    for (let i = 0; i < MAX_TOKENS; i++) {
        const currentToken = []
        currentToken.push(tokensList[i].address)
        currentToken.push(tokensList[i].decimals)
        currentToken.push(tokensList[i].label)
        currentToken.push(tokensList[i].symbol)
        tokens.push(currentToken)
    }
}

const insertTokensToDB = () => {
    db.connect(function(err) {
        if (err) {
            throw err
        }
        console.log("Connected!");
        const sql = "INSERT INTO tokens (address, decimals, label, symbol) VALUES ?"
        db.query(sql, [tokens], function (err, result) {
            if (err) {
                throw err;
            }
            console.log("Number of records inserted: " + result.affectedRows);
        });
    });
}

const addTokens = () => {
    console.log(`Adding first ${MAX_TOKENS} tokens to DB...`)
    getTokens()
    insertTokensToDB()
    console.log('Tokens successfully added!')
}

addTokens()

(
    () => {
        const mysql = require('mysql');
        const connection = mysql.createConnection({
            host: 'localhost',
            user: 'historical',
            database: 'historical',
            password: 'secret'
        });

        connection.connect();

        connection.query('SELECT 1 + 1 AS solution', function(err, rows, fields) {
            if (err) throw err;
            console.log('The solution is: ', rows[0].solution);
        });

        connection.end();



        const tokensList = require('./assets/tokens.json')
        const addressToExtract = '0x090821dfa1c5855462cefc80f800e046131bb7bb'
        const tokens = tokensList[addressToExtract]

        const extractValues = token => {
            return [
                token.address,
                token.tokenAddress,
                token.decimals,
                token.img,
                token.label,
                token.symbol,
                token.balance,
                token.balanceRaw,
                token.balanceUSD,
                token.price,
                token.isStaked,
                token.canStake,
                token.lpRewards || null,
                token.hide,
                token.canExchange,
            ]
        }

        console.log('Extracting tokens to DB...')
        const length = tokens.length > 100 ? 99 : tokens.length - 1
        for (let i = 0; i <= length; i++) {
            const token = tokens[i]
            const values = extractValues(token)
            const sql = `
                INSERT INTO defiyield.tokens_info 
                (address, tokenAddress, decimals, img, label, symbol, balance, balanceRaw, balanceUSD, price, isStaked, canStake, lpRewards, hide, canExchange)
                VALUES ?`;
            // console.log(sql)
            connection.query(sql, [values], function (error) {
                if (error) {
                    throw error
                }
                console.log(`${i + 1} of ${length + 1}:`, `${token.symbol} inserted.\n`)
            })
        }
        console.log('Extracting tokens to DB completed successfully!')
        process.exit()
    }
)()

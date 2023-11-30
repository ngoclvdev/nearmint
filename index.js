require('dotenv').config();
const nearAPI = require('near-api-js');
const {connect, KeyPair, keyStores} = nearAPI;
const {parseSeedPhrase} = require("near-seed-phrase");
const {readFileSync} = require("fs");
const {utils} = require("near-api-js");

async function main() {
    let walletData = [];
    const mnemonic = process.env.MNEMONIC;
    const { secretKey } = parseSeedPhrase(mnemonic);
    const mainWallet = { privateKey: secretKey, implicitAccountId: process.env.CONTRACT_NAME };
    try {
        walletData = JSON.parse(readFileSync('near_wallets.json', 'utf-8'));
    } catch (e) {
        console.log('NOT FOUND near_wallets.json，using main wallet');
    }
    walletData.push(mainWallet);
    const contractArgs = {
        p: "nrc-20",
        op: "mint",
        amt: "100000000",
        tick: "neat"
    };


    async function performInscribe(wallet, contractArgs, numberOfTimes) {
        const config = {
            networkId: process.env.NETWORK_ID || "mainnet",
            keyStore: new keyStores.InMemoryKeyStore(),
            nodeUrl: process.env.NODE_URL,
        };
        const keyPair = KeyPair.fromString(wallet.privateKey);
        await config.keyStore.setKey(config.networkId, wallet.implicitAccountId, keyPair);
        const near = await connect(config);
        const account = await near.account(wallet.implicitAccountId);
        const balance = await account.getAccountBalance();
        const balanceFormat = utils.format.formatNearAmount(balance.available.toString(),6);
        console.log(`Wallet: ${wallet.implicitAccountId} Balance: ${balanceFormat}`);
        for (let i = 0; i < numberOfTimes; i++) {
            try {
                if (utils.format.parseNearAmount(balance.available) > 0.1) {
                    const result = await account.functionCall({
                        contractId: "inscription.near",
                        methodName: "inscribe",
                        args: contractArgs,
                        gas: "30000000000000",
                        attachedDeposit: "0",
                    });
                    let hash = result.transaction.hash;
                    // console.log(`${wallet.implicitAccountId}, 第 ${i + 1} 次操作成功: ${'https://nearblocks.io/zh-cn/txns/' + hash}`);
                    console.log(`${wallet.implicitAccountId}, NO.${i + 1} MINT SUCCEEDED: ${'https://getblock.io/explorers/near/transactions/' + hash}`);
                    await new Promise(resolve => setTimeout(resolve, 10000));
                } else {
                    console.log(`Wallet ${wallet.implicitAccountId} has INSUFFICIENT BALANCE, ${balanceFormat} NEAR left`);
                    console.log(`STOP MINTING FOR ${wallet.implicitAccountId}`)
                    break;
                }
            } catch (error) {
                console.error(`NO.${i + 1} MINT FAILED: `, error);
            }
        }
    }
    // 10 次操作 是每个钱包都打10次
    Promise.all(walletData.map(wallet => performInscribe(wallet, contractArgs, 9999)))
        .then(() => {
            console.log("All operations COMPLETED");
        })
        .catch(error => {
            console.error("An error occurred during operation: ", error);
        });
}

main();

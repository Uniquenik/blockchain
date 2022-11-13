#!/usr/bin/env ./node_modules/.bin/ts-node

import Peer from "./src/Peer";
import Message from "./src/Message";
import MessageCreator from "./src/MessageCreator";
import { List } from "immutable";
import Block from "./src/Block";
import Transaction from "./src/Transaction";
const peer = new Peer();
const vorpal = require("vorpal")();
import * as util from "util";

vorpal
  .use(connect)
  .use(discover)
  .use(blockchain)
  .use(peers)
  .use(mine)
  .use(open)
  .use(transaction)
  .use(newWallet)
  .use(getPublicKey)
  .use(pay)
  .use(balance)
  .use(welcome)
  .delimiter("blockchain >")
  .show();


// COMMANDS
function welcome(vorpal) {
  this.log("Blockchain интерпретация");
  vorpal.exec("help");
}

function connect(vorpal) {
  vorpal
    .command(
      "connect <host> <port>",
      "Подключиться к новому устройству используя <host> и <port>."
    )
    .alias("c")
    .action((args, callback) => {
      try {
        peer.connectToPeer(args.host, args.port);
      } catch (err) {
        this.log(err);
      } finally {
        callback();
      }
    });
}

function discover(vorpal) {
  vorpal
    .command("discover", "Поиск новых пиров")
    .alias("d")
    .action((args, callback) => {
      try {
        peer.discoverPeers();
      } catch (err) {
        this.log(err);
      } finally {
        callback();
      }
    });
}

function blockchain(vorpal) {
  vorpal
    .command("blockchain", "Текущее состояние блокчейна")
    .alias("bc")
    .action((args, callback) => {
      this.log(peer.blockchain.toString());
      callback();
    });
}

function peers(vorpal) {
  vorpal
    .command("peers", "Сипсок подключенных устройств")
    .alias("p")
    .action((args, callback) => {
      peer.connectedPeers.forEach(peer => {
        this.log(`${JSON.stringify(peer.pxpPeer.socket.address())}\n`);
      }, this);
      callback();
    });
}

function mine(vorpal) {
  vorpal
    .command("mine [address]", "Майнинг нового блока, можно добавить адрес [address] для перечисления награды (по умолчанию используется последний).")
    .alias("m")
    .action((args, callback) => {
      try {
        peer.mine();
        const latestBlock: Block = peer.blockchain.latestBlock
        const blockMessage: Message = MessageCreator.sendLatestBlock(latestBlock);
        peer.broadcast(blockMessage);

        const txsToClear: List<Transaction> = latestBlock.transactions;
        txsToClear.forEach(tx => peer.broadcast(MessageCreator.sendRemovedTransaction(tx)));
      } catch (e) {
        if (e instanceof TypeError) {
          handleTypeError.call(this, e);
        } else {
          this.log(e);
        }
      } finally {
        callback();
      }
    });
}

function open(vorpal) {
  vorpal
    .command("open <port>", "Открыть порт <port> для возможности соединения")
    .alias("o")
    .action((args, callback) => {
      try {
        peer.startServer(args.port);
        this.log(`Прослушивание на порту ${args.port}`);
      } catch (err) {
        this.log(err);
      } finally {
        callback();
      }
    });
}

function transaction(vorpal) {
  vorpal
    .command("transactions", "Список неподтвержденных транзакций")
    .alias("tx")
    .action((args, callback) => {
      this.log(peer.mempool.toString());
      callback();
    });
}

function newWallet(vorpal) {
  vorpal
    .command("wallet <password>", "Создание нового кошелька с паролем <password> (в пароле должны быть буквы)")
    .alias("w")
    .action((args, callback) => {
      args.password = args.password.toString();
      peer.newWallet(args.password);
      const hidePass = args.password.replace(/./g, "*");
      this.log(`Создан новый кошелек с паролем ${hidePass}.\n`);
      this.log(`Адрес: ${peer.wallet.publicKey}\n`);
      callback();
    });
}

function getPublicKey(vorpal) {
  vorpal
    .command("key", "Получить свой публичный ключ")
    .alias("k")
    .action((args, callback) => {
      try {
        this.log(peer.wallet.publicKey);
      } catch (e) {
        if (e instanceof TypeError) {
          handleTypeError.call(this, e);
        } else {
          this.log(e);
        }
      } finally {
        callback();
      }
    });
}

function pay(vorpal) {
  vorpal
    .command(
      "pay <address> <amount> <fee> <password>",
      "Совершить платеж на адрес <address> указав количество, комиссию и пароль от кошелька (<amount>, <fee>, <password>)"
    )
    .action((args, callback) => {
      const address = args.address;
      const amount = args.amount;
      const password = args.password;
      const fee = args.fee;
      try {
        const transaction = peer.createTransaction(
          List([{ amount, address, fee }]),
          password
        );
        peer.mempool.addTransaction(transaction);
        const action: Message = MessageCreator.sendLatestTransaction(transaction);
        peer.broadcast(action);
      } catch (err) {
        this.log(err);
      } finally {
        callback();
      }
    });
}

function balance(vorpal) {
  vorpal
    .command("balance [address]", "Баланс, можно указать также кошелек параметром [address]")
    .alias("b")
    .action((args, callback) => {
      try {
        this.log(peer.getBalance(args.address))
      } catch (e) {
        if (e instanceof TypeError) {
          handleTypeError.call(this, e);
        }
      } finally {
        callback();
      }
    })
}

// Error Handlers
function handleTypeError(e) {
  if (e.message.includes("'publicKey'")) {
    this.log('\nНеобходимо создать кошелек.\n');
  } else {
    this.log(e);
  }
}

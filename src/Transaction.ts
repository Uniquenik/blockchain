import Input from "./Input";
import Output from "./Output";
import { List } from "immutable";
import * as crypto from "crypto";

class Transaction {
  public readonly type: "regular" | "fee" | "reward";
  public readonly inputs: List<Input>;
  public readonly outputs: List<Output>;
  public static readonly reward: number = 100;

  constructor(
    type: "regular" | "fee" | "reward",
    inputs: List<Input>,
    outputs: List<Output>
  ) {
    this.type = type;
    this.inputs = inputs;
    this.outputs = outputs;
  }

  get hash() {
    const inputs = JSON.stringify(this.inputs.toJS());
    const outputs = JSON.stringify(this.outputs.toJS());

    return crypto
      .createHash("sha256")
      .update(this.type + inputs + outputs)
      .digest("hex");
  }

  get inputTotal(): number {
    return this.inputs.reduce((total, input) => total + input.amount, 0);
  }

  get outputTotal(): number {
    return this.outputs.reduce((total, output) => total + output.amount, 0);
  }

  get fee(): number {
    if (this.type === "regular") {
      return this.inputTotal - this.outputTotal;
    } else {
      throw `У типа транзакции ${this.type} нет комиссия`
    }
  }

  isInputsMoreThanOutputs() {
    const inputTotal = this.inputTotal;
    const outputTotal = this.outputTotal;

    if (inputTotal < outputTotal) {
      throw `Недостаточный баланс: ${inputTotal} < ${outputTotal}`;
    }
  }

  verifyInputSignatures() {
    try {
      this.inputs.forEach(input => input.verifySignature());
    } catch (err) {
      throw err;
    }
  }

  hasSameInput(tx): boolean {
    return tx.inputs.some(input => this.inputs.some(i => i.equals(input)));
  }

  isValidTransaction(): boolean {
    try {
      this.isInputsMoreThanOutputs();
      this.verifyInputSignatures();
      return true;
    } catch (err) {
      throw err;
    }
  }

  equals(tx): boolean {
    return (
      this.type === tx.type &&
      this.inputs.equals(tx.inputs) &&
      this.outputs.equals(tx.outputs) &&
      this.hash === tx.hash
    );
  }

  hashCode(): number {
    return parseInt(String(parseInt(this.hash, 10)), 32);
  }

  feeTransaction(address: string) {
    const inputTotal = this.inputTotal;
    const outputTotal = this.outputTotal;

    if (inputTotal > outputTotal) {
      const fee = inputTotal - outputTotal;
      const outputs: List<Output> = List([{ address, amount: fee }]);
      return new Transaction("fee", List(), outputs);
    } else {
      throw `Нет комиссии за транзакцию`;
    }
  }

  static rewardTransaction(address: string) {
    const outputs: List<Output> = List([
      { address, amount: Transaction.reward }
    ]);
    return new Transaction("reward", List(), outputs);
  }

  static fromJS(json) {
    const inputs: List<Input> = List(json.inputs.map(input => Input.fromJS(input)))
    const outputs: List<Output> = List(json.outputs);
    return new Transaction(json.type, inputs, outputs);
  }
}

export default Transaction;

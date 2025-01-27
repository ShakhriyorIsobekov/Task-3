const crypto = require("crypto");
const readline = require("readline");

class Dice {
  constructor(faces) {
    this.faces = faces;
  }

  roll() {
    return this.faces[Math.floor(crypto.randomInt(0, this.faces.length))];
  }
}

class DiceParser {
  static parseDice(args) {
    if (args.length < 3) {
      throw new Error(
        "You must provide at least three dice configurations. Example: 2,2,4,4,9,9 6,8,1,1,8,6 7,5,3,7,5,3"
      );
    }

    return args.map((arg, index) => {
      const faces = arg.split(",").map(Number);
      if (faces.some(isNaN)) {
        throw new Error(
          `Invalid dice configuration at argument ${
            index + 1
          }: Only integers are allowed.`
        );
      }
      return new Dice(faces);
    });
  }
}

class FairRandomGenerator {
  constructor() {
    this.secretKey = null;
  }

  generateRandom(max) {
    this.secretKey = crypto.randomBytes(32);
    const randomNumber = this.generateUniformRandom(max);
    const hmac = this.generateHMAC(randomNumber);

    return { randomNumber, hmac };
  }

  generateHMAC(message) {
    const hmac = crypto.createHmac("sha3-256", this.secretKey);
    hmac.update(message.toString());
    return hmac.digest("hex");
  }

  generateUniformRandom(max) {
    let num;
    do {
      num = crypto.randomInt(0, max);
    } while (num >= max);
    return num;
  }

  getSecretKey() {
    return this.secretKey.toString("hex");
  }
}

class ProbabilityCalculator {
  static calculate(dice) {
    const probabilities = [];
    for (let i = 0; i < dice.length; i++) {
      probabilities[i] = [];
      for (let j = 0; j < dice.length; j++) {
        if (i === j) {
          probabilities[i][j] = 0.5;
        } else {
          probabilities[i][j] = this.calculateProbability(dice[i], dice[j]);
        }
      }
    }
    return probabilities;
  }

  static calculateProbability(dice1, dice2) {
    let wins = 0;
    for (const face1 of dice1.faces) {
      for (const face2 of dice2.faces) {
        if (face1 > face2) wins++;
      }
    }
    return wins / (dice1.faces.length * dice2.faces.length);
  }
}

class ProbabilityTable {
  static display(probabilities) {
    console.log("\nProbability Table:");
    console.log("\t" + probabilities.map((_, i) => `D${i + 1}`).join("\t"));
    probabilities.forEach((row, i) => {
      console.log(
        `D${i + 1}\t` + row.map((prob) => prob.toFixed(2)).join("\t")
      );
    });
  }
}

class Game {
  constructor(dice) {
    this.dice = dice;
    this.generator = new FairRandomGenerator();
  }

  async determineFirstMove(rl) {
    console.log("Let's determine who makes the first move.");
    const { randomNumber, hmac } = this.generator.generateRandom(2);
    console.log(`I selected a random value in the range 0..1 (HMAC=${hmac}).`);

    const userInput = await this.prompt(
      rl,
      "Try to guess my selection.\n0 - 0\n1 - 1\nX - exit\n? - help\nYour selection: "
    );

    if (userInput === "X" || userInput === "x") {
      console.log("Thanks for playing!");
      process.exit(0);
    }

    const userGuess = parseInt(userInput, 10);
    if (isNaN(userGuess) || userGuess < 0 || userGuess > 1) {
      console.log("Invalid input. Please choose 0 or 1.");
      return this.determineFirstMove(rl);
    }

    console.log(
      `My selection: ${randomNumber} (KEY=${this.generator.getSecretKey()}).`
    );

    if (userGuess === randomNumber) {
      console.log("You guessed correctly! You make the first move.");
      return true;
    } else {
      console.log("I make the first move.");
      return false;
    }
  }

  async play() {
    console.log("Welcome to the Non-Transitive Dice Game!");
    console.log("Type 'help' for probabilities or 'exit' to quit.\n");

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const userGoesFirst = await this.determineFirstMove(rl);

    while (true) {
      const userInput = await this.prompt(
        rl,
        "Choose your dice:\n" +
          this.dice.map((d, i) => `${i} - ${d.faces.join(",")}`).join("\n") +
          "\nX - exit\n? - help\nYour selection: "
      );

      if (userInput === "X" || userInput === "x") {
        console.log("Thanks for playing!");
        break;
      }

      if (userInput === "?") {
        const probabilities = ProbabilityCalculator.calculate(this.dice);
        ProbabilityTable.display(probabilities);
        continue;
      }

      const userDiceIndex = parseInt(userInput, 10);
      if (
        isNaN(userDiceIndex) ||
        userDiceIndex < 0 ||
        userDiceIndex >= this.dice.length
      ) {
        console.log("Invalid choice. Please choose a valid dice number.");
        continue;
      }

      console.log(
        `You chose the [${this.dice[userDiceIndex].faces.join(",")}] dice.`
      );

      const computerDiceIndex = this.generator.generateUniformRandom(
        this.dice.length
      );
      console.log(
        `I choose the [${this.dice[computerDiceIndex].faces.join(",")}] dice.`
      );

      console.log("It's time for my throw.");
      const { randomNumber: computerThrow, hmac: computerHMAC } =
        this.generator.generateRandom(
          this.dice[computerDiceIndex].faces.length
        );
      console.log(
        `I selected a random value in the range 0..${
          this.dice[computerDiceIndex].faces.length - 1
        } (HMAC=${computerHMAC}).`
      );

      const userModInput = await this.prompt(
        rl,
        `Add your number modulo ${this.dice[computerDiceIndex].faces.length}:\n` +
          Array.from(
            { length: this.dice[computerDiceIndex].faces.length },
            (_, i) => `${i} - ${i}`
          ).join("\n") +
          "\nX - exit\n? - help\nYour selection: "
      );

      if (userModInput === "X" || userModInput === "x") {
        console.log("Thanks for playing!");
        break;
      }

      const userNumber = parseInt(userModInput, 10);
      if (
        isNaN(userNumber) ||
        userNumber < 0 ||
        userNumber >= this.dice[computerDiceIndex].faces.length
      ) {
        console.log("Invalid input. Please choose a valid number.");
        continue;
      }

      console.log(
        `My number is ${computerThrow} (KEY=${this.generator.getSecretKey()}).`
      );
      const result =
        (computerThrow + userNumber) %
        this.dice[computerDiceIndex].faces.length;
      console.log(
        `The result is ${computerThrow} + ${userNumber} = ${result} (mod ${this.dice[computerDiceIndex].faces.length}).`
      );

      const computerRoll = this.dice[computerDiceIndex].faces[result];
      console.log(`My throw is ${computerRoll}.`);

      console.log("It's time for your throw.");
      const { randomNumber: userThrow, hmac: userHMAC } =
        this.generator.generateRandom(this.dice[userDiceIndex].faces.length);
      console.log(
        `I selected a random value in the range 0..${
          this.dice[userDiceIndex].faces.length - 1
        } (HMAC=${userHMAC}).`
      );

      const userModThrowInput = await this.prompt(
        rl,
        `Add your number modulo ${this.dice[userDiceIndex].faces.length}:\n` +
          Array.from(
            { length: this.dice[userDiceIndex].faces.length },
            (_, i) => `${i} - ${i}`
          ).join("\n") +
          "\nX - exit\n? - help\nYour selection: "
      );

      if (userModThrowInput === "X" || userModThrowInput === "x") {
        console.log("Thanks for playing!");
        break;
      }

      const userModNumber = parseInt(userModThrowInput, 10);
      if (
        isNaN(userModNumber) ||
        userModNumber < 0 ||
        userModNumber >= this.dice[userDiceIndex].faces.length
      ) {
        console.log("Invalid input. Please choose a valid number.");
        continue;
      }

      console.log(
        `My number is ${userThrow} (KEY=${this.generator.getSecretKey()}).`
      );
      const userResult =
        (userThrow + userModNumber) % this.dice[userDiceIndex].faces.length;
      console.log(
        o`The result is ${userThrow} + ${userModNumber} = ${userResult} (mod ${this.dice[userDiceIndex].faces.length}).`
      );

      const userRoll = this.dice[userDiceIndex].faces[userResult];
      console.log(`Your throw is ${userRoll}.`);

      if (userRoll > computerRoll) {
        console.log(`You win (${userRoll} > ${computerRoll})!`);
      } else if (userRoll < computerRoll) {
        console.log(`I win (${computerRoll} > ${userRoll})!`);
      } else {
        console.log("It's a tie!");
      }
    }

    rl.close();
  }

  prompt(rl, query) {
    return new Promise((resolve) => rl.question(query, resolve));
  }
}

try {
  const dice = DiceParser.parseDice(process.argv.slice(2));
  const game = new Game(dice);
  game.play();
} catch (error) {
  console.error("Error:", error.message);
}

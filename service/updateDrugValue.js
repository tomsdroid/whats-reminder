// ./service/updateDrugValue

const db = require("./database.js");



// execute
const main = async () => {
  const users = await db.from("users").select();

  console.log(users);
}

main();

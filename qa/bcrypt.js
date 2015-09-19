var bcrypt = require('bcryptjs');
var salt = bcrypt.genSaltSync(10);
var hash = bcrypt.hashSync("B4c0/\/", salt);

console.log(salt);
console.log(bcrypt.getSalt(hash));
console.log(hash)

console.log(bcrypt.compareSync("B4c0/\/", hash));
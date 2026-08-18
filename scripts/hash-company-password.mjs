import { randomBytes, scryptSync } from 'node:crypto'
import { createInterface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'

const rl = createInterface({ input, output })
const password = await rl.question('Firmenpasswort (Eingabe ist sichtbar): ')
rl.close()
if (password.length < 12) {
  console.error('Bitte mindestens 12 Zeichen verwenden.')
  process.exit(1)
}
const salt = randomBytes(24).toString('hex')
const hash = scryptSync(password, salt, 64).toString('hex')
console.log(`\nCOMPANY_PASSWORD_SCRYPT=${salt}:${hash}`)

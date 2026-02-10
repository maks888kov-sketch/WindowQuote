const res = await fetch(
  'https://window-quote.vercel.app/api/admin/users',
  {
    headers: {
      Authorization: 'Bearer TEST'
    }
  }
)

const text = await res.text()

console.log('STATUS:', res.status)
console.log('BODY:', text)

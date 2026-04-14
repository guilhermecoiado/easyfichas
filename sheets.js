async function getFichas(){

const res = await fetch(API)

return await res.json()

}
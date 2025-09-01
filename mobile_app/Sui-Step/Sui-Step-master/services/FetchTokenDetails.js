// Fetching token details from Coingecko, live saver (logo fetching later)
const url = "https://api.coingecko.com/api/v3/coins/sui";
const options = {
  method: "GET",
  headers: {
    accept: "application/json",
    "x-cg-demo-api-key": "CG-kcTo33v4GLnJk2HsAHh7mAu4",
  },
};

fetch(url, options)
  .then((res) => res.json())
  .then((json) => console.log(json))
  .catch((err) => console.error(err));

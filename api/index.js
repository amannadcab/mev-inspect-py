const express = require("express");
const cors = require("cors");
const { getDailyTransaction , getRecentTranscations} = require("./controller/arbitrage");

const app = express();
app.use(cors({ origin: "*" }));

app.use(express.json());


app.get("/api/stats", async (_, res) => {
  try {
    const data = await getDailyTransaction();
    res.status(200).send({ status: true, data: data });
  } catch (error) {
    res.status(400).send({ status: false, data: [] });
  }
});

app.get("/api/recents", async (req, res) => {
  try {
    const data = await getRecentTranscations();
    console.log(data)
    return res.status(200).send({ status: true, data: data });

  } catch (error) {
    console.log(error);
    return res.status(400).send({ status: false, data: [] });
  }
});


// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

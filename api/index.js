const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const {
  getDailyTransaction,
  getRecentTranscations,
  getTopTranscations,
  getLiquidationTranscations,
  getArbitrageTransactions,
  loadPrice,
} = require("./controller/arbitrage");

const app = express();
app.use(cors({ origin: "*" }));

app.use(express.json());
const server = http.createServer(app);

const io = new Server(server, {
  path:"/ws",
  cors: {
    origin: "*",
    methods: ["GET"],
    allowedHeaders: ["Content-Type"],
  },
});

io.on("connection", async(socket) => {


  socket.emit("connected");

  const statsdata = await getDailyTransaction();
  socket.emit("stats", JSON.stringify({ status: true, data: statsdata }));

  const recentsdata = await getRecentTranscations();
  socket.emit("recent", JSON.stringify({ status: true, data: recentsdata.result }));

  const topdata = await getTopTranscations();
  socket.emit("top", JSON.stringify({ status: true, data: topdata }));

  const liquidationdata = await getLiquidationTranscations();
  socket.emit("liquidation", JSON.stringify({ status: true, data: liquidationdata }));

  socket.on("disconnect", (reason) => {
    console.log("User disconnected:", reason);
  });
  
  socket.on("error", (error) => {
    console.error("Socket Error:", error);
    socket.emit("disconnect");
  });
});

app.get("/api/stats", async (req, res) => {
  day = req.query.filter;
  // console.log("day:",day)
  if(!day) day = 1; 
  try {
    const data = await getDailyTransaction(day);
    res.status(200).send({ status: true, data: data });
  } catch (error) {
    res.status(400).send({ status: false, data: [] });
  }
});

app.get("/api/recents", async (req, res) => {
  try {
    const data = await getRecentTranscations();
    return res.status(200).send({ status: true, data: data });
  } catch (error) {
    console.log(error);
    return res.status(400).send({ status: false, data: [] });
  }
});

app.get("/api/arbitrage", async (req, res) => {
  try {
    const data = await getArbitrageTransactions();
    return res.status(200).send({ status: true, data: data });
  } catch (error) {
    console.log(error);
    return res.status(400).send({ status: false, data: [] });
  }
});

app.get("/api/top", async (req, res) => {
  try {
    const data = await getTopTranscations();
    return res.status(200).send({ status: true, data: data });
  } catch (e) {
    console.log(e);
    return res.status(400).send({ status: false, data: [] });
  }
});

app.get("/api/liquidation", async (req, res) => {
  try {
    const data = await getLiquidationTranscations();
    return res.status(200).send({ status: true, data: data });
  } catch (e) {
    console.log(e);
    return res.status(400).send({ status: false, data: [] });
  }
});
let clock = 0;

let statsD,recentD,topD,liquiditationD;

async function socketRecentTransaction() {
  const data = await getRecentTranscations();
  if(data?.arbitrageBlock > recentD?.arbitrageBlock || (Number(data?.sandwichBlock) >  Number(recentD?.sandwichBlock))|| !recentD) {
    recentD = data;
    io.emit("recent", JSON.stringify({ status: true, data: recentD?.result }));
  }
}

async function socketStats() {
  const data  = await getDailyTransaction();
  if(Number(data?.totalArbitrageUsd) != Number(statsD?.totalArbitrageUsd)|| Number(data.totalSandwichUsd) != Number(statsD?.totalSandwichUsd) || Number(data.totalLiquidationusd) != Number(statsD?.totalLiquidationusd) || !statsD) {
    statsD = data;
    io.emit("stats", JSON.stringify({ status: true, data: statsD }));
  }
}

async function socketTopTranscations() {
  const data = await getTopTranscations();
  if(( Number(data?.arbitrageBlock) >  Number(topD?.arbitrageBlock))|| (Number(data?.sandwichBlock) >  Number(topD?.sandwichBlock)) || !topD) {
    topD = data;
    io.emit("top", JSON.stringify({ status: true, data: topD }));
  }
}

async function socketLiquidationTranscations() {
  const data = await getLiquidationTranscations();
  if(( Number(data?.arbitrageBlock) >  Number(liquiditationD?.arbitrageBlock))|| (Number(data?.sandwichBlock) >  Number(liquiditationD?.sandwichBlock)) || !liquiditationD) {
    liquiditationD = data;
    io.emit("liquidation", JSON.stringify({ status: true, data: liquiditationD }));
  }
}
const PORT = process.env.PORT || 3000;

server.listen(4000, () => {
  console.log("Socket.io server listening on Port 4000");
});

app.listen(PORT, async () => {
  console.log(`Server is running on port ${PORT}`);
  setInterval(async () => {
    if (clock == 0) {
      clock = 1;
      await socketRecentTransaction();
      await socketStats();
      await socketTopTranscations();
      await socketLiquidationTranscations();
      clock = 0;
    }
  }, 10000);
});

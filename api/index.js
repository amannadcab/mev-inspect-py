const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const {
  getDailyTransaction,
  getRecentTranscations,
  getTopTranscations,
  loadPrice,
} = require("./controller/arbitrage");

const app = express();
app.use(cors({ origin: "*" }));

app.use(express.json());
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET"],
    allowedHeaders: ["Content-Type"],
  },
});

io.on("connection", async(socket) => {
  await loadPrice();
  // console.log("A user connected", socket.id);
  socket.emit("connected");

  const statsdata = await getDailyTransaction();
  socket.emit("stats", JSON.stringify({ status: true, data: statsdata }));

  const recentsdata = await getRecentTranscations();
  socket.emit("recent", JSON.stringify({ status: true, data: recentsdata.result }));

  const topdata = await getTopTranscations();
  socket.emit("top", JSON.stringify({ status: true, data: topdata }));

  socket.on("disconnect", (reason) => {
    console.log("User disconnected:", reason);
  });
  
  socket.on("error", (error) => {
    console.error("Socket Error:", error);
    socket.emit("disconnect");
  });
});

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
    console.log(error);
    return res.status(400).send({ status: false, data: [] });
  }
});

let clock = 0;

let statsD,recentD,topD;

async function socketRecentTransaction() {
  const data = await getRecentTranscations();
  if(data?.arbitrageBlock > recentD?.arbitrageBlock || !recentD) {
    recentD = data;
    io.emit("recent", JSON.stringify({ status: true, data: recentD.result }));
  }
}

async function socketStats() {
  const data  = await getDailyTransaction();
  if(Number(data?.totalArbitrageUsd) != Number(statsD?.totalArbitrageUsd)|| Number(data.totalSandwichUsd) != Number(statsD?.totalSandwichUsd) || !statsD) {
    statsD = data;
    io.emit("stats", JSON.stringify({ status: true, data: statsD }));
  }
}

async function socketTopTranscations() {
  const data = await getTopTranscations();
  if((data.arbitrage.length>0 && Number(data.arbitrage[0]?.block_number) >  Number(topD?.arbitrage[0]?.block_number))|| (data.sandwich.length>0 && Number(data.sandwich[0]?.block_number) >  Number(topD?.sandwich[0]?.block_number)) || !topD) {
    topD = data;
    io.emit("top", JSON.stringify({ status: true, data: topD }));
  }
}

 setInterval(async () => {
  if (clock == 0) {
    clock = 1;
    await socketRecentTransaction();
    await socketStats();
    await socketTopTranscations();
    clock = 0;
  }
}, 10000);

const PORT = process.env.PORT || 3000;

server.listen(4000, () => {
  console.log("Socket.io server listening on Port 4000");
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

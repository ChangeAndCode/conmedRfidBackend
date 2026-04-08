import express from "express";
import "dotenv/config";
import cors from "cors";
import {logger} from "./config/logger"

const app = express();
const PORT: number = Number(process.env.PORT);
if (!PORT){
    throw new Error("PORT no está definido o no es válido");
} else {
    logger.info(`El puerto ${PORT} disponible`);
}
const allowedOrigins: string[] = [
    "http://localhost:3001",
];
const corsoptions = {
    origin: function (origin: string | undefined, callback: Function){
        if(!origin || allowedOrigins.includes(origin)){
            callback(null,true);
        } else {
            callback(new Error("No permitido por Cors"));
        }
    },
    credentials: true,
    optionsSuccessStatus: 200,
    methods:['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Proxy-Source', 'X-Forwarded-For', 'X-Internal-Token', 'Accept', 'User-Agent'],
};

app.set('trust proxy', 1);
app.use(cors(corsoptions));

app.use(express.json({limit: '100mb'})); // Payload size limit
app.use(express.urlencoded({ extended: true, limit: '100mb'})); // Payload complex forms size limit

app.get("/", (req, res)=>{
    res.send("Sistema RFID en funcionamiento");
});

app.listen(PORT, ()=>{
    logger.info(`Sistema RFID corriendo en http://localhost:${PORT}`);
});
import axios from 'axios';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

const API_URL = 'https://relayer-api.horizenlabs.io/api/v1';

const bufvk = fs.readFileSync("./assets/noir/vk");
const bufproof = fs.readFileSync("./assets/noir/proof");
const base64Proof = bufproof.toString("base64");
const base64Vk = bufvk.toString("base64");


async function main(){
    const params = {
        "proofType": "ultraplonk",
        "proofOptions": {
            "numberOfPublicInputs": 1
        },
            "vk": base64Vk
    }

    const requestResponse = await axios.post(`${API_URL}/register-vk/${process.env.API_KEY}`, params)
    console.log(requestResponse.data)

}


main();

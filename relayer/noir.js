import axios from 'axios';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

const API_URL = 'https://relayer-api.horizenlabs.io/api/v1';

const vkhex = fs.readFileSync("./assets/noir/vk.hex").toString();
const proofhex = fs.readFileSync("./assets/noir/proof.hex").toString();
const pubhex = fs.readFileSync("./assets/noir/pub.hex").toString();

async function main() {
    
    const params = {
        "proofType": "ultraplonk",
        "vkRegistered": false,
        "proofData": {
            "proof": proofhex.split("\n")[0],
            "publicSignals": pubhex.split("\n").slice(0,-1),
            "vk": vkhex.split("\n")[0]
        }
    }

    const requestResponse = await axios.post(`${API_URL}/submit-proof/${process.env.API_KEY}`, params)
    console.log(requestResponse.data)

    if(requestResponse.data.optimisticVerify != "success"){
        console.error("Proof verification, check proof artifacts");
        return;
    }

    while(true){
        const jobStatusResponse = await axios.get(`${API_URL}/job-status/${process.env.API_KEY}/${requestResponse.data.jobId}`);
        if(jobStatusResponse.data.status === "Finalized"){
            console.log("Job finalized successfully");
            console.log(jobStatusResponse.data);
            break;
        }else{
            console.log("Job status: ", jobStatusResponse.data.status);
            console.log("Waiting for job to finalize...");
            await new Promise(resolve => setTimeout(resolve, 5000)); // Wait for 5 seconds before checking again
        }
    }
}

main();
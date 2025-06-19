import axios from 'axios';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

const API_URL = 'https://relayer-api.horizenlabs.io/api/v1';

const proof = JSON.parse(fs.readFileSync("./assets/risc0/proof.json")); // Following the Risc Zero tutorial

async function main() {
    
    const params = {
        "proofType": "risc0",
        "vkRegistered": false,
        "chainId":11155111,
        "proofOptions": {
            "version": "V1_2" // Replace this with the Risc0 version 
        },
        "proofData": {
            "proof": proof.proof,
            "publicSignals": proof.pub_inputs,
            "vk": proof.image_id
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
        if(jobStatusResponse.data.status === "Aggregated"){
            console.log("Job aggregated successfully");
            console.log(jobStatusResponse.data);
            fs.writeFileSync("aggregation.json", JSON.stringify({...jobStatusResponse.data.aggregationDetails, aggregationId: jobStatusResponse.data.aggregationId}))
            break;
        }else{
            console.log("Job status: ", jobStatusResponse.data.status);
            console.log("Waiting for job to aggregated...");
            await new Promise(resolve => setTimeout(resolve, 20000)); // Wait for 5 seconds before checking again
        }
    }
}

main();
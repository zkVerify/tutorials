import axios from 'axios';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

const API_URL = 'https://relayer-api.horizenlabs.io/api/v1';

const bufvk = fs.readFileSync("./assets/noir/vk");
const bufproof = fs.readFileSync("./assets/noir/proof");
const base64Proof = bufproof.toString("base64");
const base64Vk = bufvk.toString("base64");

async function main() {

    if(!fs.existsSync("noir-vkey.json")){
        // Registering the verification key
        try{
            const regParams = {
                "proofType": "ultraplonk",
                "proofOptions": {
                    "numberOfPublicInputs": 1
                },
                "vk": base64Vk
            }
            const regResponse = await axios.post(`${API_URL}/register-vk/${process.env.API_KEY}`, regParams);
            fs.writeFileSync(
                "noir-vkey.json",
                JSON.stringify(regResponse.data)
            );
        }catch(error){
            fs.writeFileSync(
                "noir-vkey.json",
                JSON.stringify(error.response.data)
            );
        }
    }
    

    const vk = JSON.parse(fs.readFileSync("noir-vkey.json"));
    
    const params = {
        "proofType": "ultraplonk",
        "vkRegistered": true,
        "chainId":11155111,
        "proofOptions": {
            "numberOfPublicInputs": 1
        },
        "proofData": {
            "proof": base64Proof,
            "vk": vk.vkHash || vk.meta.vkHash
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
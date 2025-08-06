import axios from 'axios';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

const API_URL = 'https://relayer-api.horizenlabs.io/api/v1';

const proof = JSON.parse(fs.readFileSync("./assets/circom/proof.json"));
const publicInputs = JSON.parse(fs.readFileSync("./assets/circom/public.json"));
const key = JSON.parse(fs.readFileSync("./assets/circom/main.groth16.vkey.json"));

async function main() {

    // Registering the verification key
    if(!fs.existsSync("circom-vkey.json")){
        try{
            const regParams = {
                "proofType": "groth16",
                "proofOptions": {
                    "library": "snarkjs",
                    "curve": "bn128"
                },
                "vk": key
            }
            const regResponse = await axios.post(`${API_URL}/register-vk/${process.env.API_KEY}`, regParams);
            fs.writeFileSync(
                "circom-vkey.json",
                JSON.stringify(regResponse.data)
            );
        }catch(error){
            fs.writeFileSync(
                "circom-vkey.json",
                JSON.stringify(error.response.data)
            );
        }
    }
    

    const vk = JSON.parse(fs.readFileSync("circom-vkey.json"));

    const params = {
        "proofType": "groth16",
        "vkRegistered": true,
        "chainId":845320009,
        "proofOptions": {
            "library": "snarkjs",
            "curve": "bn128"
        },
        "proofData": {
            "proof": proof,
            "publicSignals": publicInputs,
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
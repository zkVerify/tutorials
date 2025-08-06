import axios from "axios";
import { NextApiRequest, NextApiResponse } from "next";
import { Buffer } from "buffer";
import fs from "fs";
import path from "path";

export default async function handler(req: NextApiRequest, res: NextApiResponse){
    
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
    try{
        const API_URL = 'https://relayer-api.horizenlabs.io/api/v1';

        const proofUint8 = new Uint8Array(Object.values(req.body.proof));

        if(fs.existsSync(path.join(process.cwd(), "public", "multiply", "vkey.json")) === false) {
          await registerVk(req.body.vk);
          await new Promise(resolve => setTimeout(resolve, 5000));
        }

        const vk = fs.readFileSync(
          path.join(
            process.cwd(),
            "public",
            "multiply",
            "vkey.json"
          ),
          "utf-8"
        );

        const params = {
            "proofType": "ultraplonk",
            "vkRegistered": true,
            "proofOptions": {
                "numberOfPublicInputs": 1 
            },
            "proofData": {
                "proof": Buffer.from(concatenatePublicInputsAndProof(req.body.publicInputs, proofUint8)).toString("base64"),
                "vk": JSON.parse(vk).vkHash || JSON.parse(vk).meta.vkHash,
            }    
        }

        const requestResponse = await axios.post(`${API_URL}/submit-proof/${process.env.API_KEY}`, params)
        console.log(requestResponse.data)

        if(requestResponse.data.optimisticVerify != "success"){
            console.error("Proof verification, check proof artifacts");
            return;
        }

        while(true){
          try{
            const jobStatusResponse = await axios.get(`${API_URL}/job-status/${process.env.API_KEY}/${requestResponse.data.jobId}`);
            console.log("Job Status: ", jobStatusResponse.data);
            if(jobStatusResponse.data.status === "IncludedInBlock"){
                console.log("Job Included in Block successfully");
                res.status(200).json(jobStatusResponse.data);
                return;
            }else{
                console.log("Job status: ", jobStatusResponse.data.status);
                console.log("Waiting for job to finalize...");
                await new Promise(resolve => setTimeout(resolve, 5000)); // Wait for 5 seconds before checking again
            }
          } catch (error: any) {
            if(error.response.status === 503){
              console.log("Service Unavailable, retrying...");
              await new Promise(resolve => setTimeout(resolve, 5000)); // Wait for 5 seconds before retrying
            }
          }
        }
    }catch(error){
        console.log(error)
    }
}

function hexToUint8Array(hex: any) {
  if (hex.startsWith('0x')) hex = hex.slice(2);
  if (hex.length % 2 !== 0) hex = '0' + hex;

  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

function concatenatePublicInputsAndProof(publicInputsHex: any, proofUint8: any) {
  const publicInputBytesArray = publicInputsHex.flatMap((hex: any) =>
    Array.from(hexToUint8Array(hex))
  );

  const publicInputBytes = new Uint8Array(publicInputBytesArray);

  console.log(publicInputBytes.length, proofUint8.length)

  const newProof = new Uint8Array(publicInputBytes.length + proofUint8.length);
  newProof.set(publicInputBytes, 0);
  newProof.set(proofUint8, publicInputBytes.length);

  return newProof;
}

async function registerVk(vk: any){

  const API_URL = "https://relayer-api.horizenlabs.io/api/v1";

  const params = {
    proofType: "ultraplonk",
    vk: vk,
    proofOptions: {
      "numberOfPublicInputs": 1
    },
  };

  try{
    const res = await axios.post(
      `${API_URL}/register-vk/${process.env.API_KEY}`,
      params
    )
    console.log(res)
    fs.writeFileSync(
        path.join(process.cwd(), "public", "multiply", "vkey.json"),
        JSON.stringify(res.data)
      );
  }catch(error: any) {
    console.log(error.response)
    fs.writeFileSync(
        path.join(process.cwd(), "public", "multiply", "vkey.json"),
        JSON.stringify(error.response.data)
      );
  }
}
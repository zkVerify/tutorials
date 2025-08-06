import axios from "axios";
import { NextApiRequest, NextApiResponse } from "next";
import fs from "fs";
import path from "path";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const API_URL = "https://relayer-api.horizenlabs.io/api/v1";

    if(fs.existsSync(path.join(process.cwd(), "public", "assets", "vkey.json")) === false) {
      await registerVk();
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }

    const vk = fs.readFileSync(
      path.join(
        process.cwd(),
        "public",
        "assets",
        "vkey.json"
      ),
      "utf-8"
    );

    const params = {
      proofType: "groth16",
      vkRegistered: true,
      proofOptions: {
        library: "snarkjs",
        curve: "bn128",
      },
      proofData: {
        proof: req.body.proof,
        publicSignals: req.body.publicInputs,
        vk: JSON.parse(vk).vkHash || JSON.parse(vk).meta.vkHash,
      },
    };

    const requestResponse = await axios.post(
      `${API_URL}/submit-proof/${process.env.API_KEY}`,
      params
    );
    console.log(requestResponse.data);

    if (requestResponse.data.optimisticVerify != "success") {
      console.error("Proof verification, check proof artifacts");
      return;
    }

    while (true) {
      try{
        const jobStatusResponse = await axios.get(
          `${API_URL}/job-status/${process.env.API_KEY}/${requestResponse.data.jobId}`
        );
        if (jobStatusResponse.data.status === "IncludedInBlock") {
          console.log("Job Included in Block successfully");
          res.status(200).json(jobStatusResponse.data);
          return;
        } else {
          console.log("Job status: ", jobStatusResponse.data.status);
          console.log("Waiting for job to finalize...");
          await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait for 5 seconds before checking again
        }
      }catch (error: any) {
        if (error.response && error.response.status === 503) {
          console.log("Service Unavailable, retrying...");
          await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait for 5 seconds before retrying
        }
      }
    }
  } catch (error) {
    console.log(error);
  }
}

async function registerVk() {

  const API_URL = "https://relayer-api.horizenlabs.io/api/v1";
  const vk = fs.readFileSync(
    path.join(process.cwd(), "public", "assets", "main.groth16.vkey.json"),
    "utf-8"
  );

  const params = {
    proofType: "groth16",
    vk: JSON.parse(vk),
    proofOptions: {
      library: "snarkjs",
      curve: "bn128",
    },
  };

  console.log(params)

  await axios.post(
      `${API_URL}/register-vk/${process.env.API_KEY}`,
      params
    ).then((response) => {
      console.log("Verification key registered successfully:", response.data);
      fs.writeFileSync(
        path.join(process.cwd(), "public", "assets", "vkey.json"),
        JSON.stringify(response.data)
      );
    }).catch((error) => {
      fs.writeFileSync(
        path.join(process.cwd(), "public", "assets", "vkey.json"),
        JSON.stringify(error.response.data)
      );
    });

}
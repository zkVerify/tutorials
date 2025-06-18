import { zkVerifySession, ZkVerifyEvents, Risc0Version } from "zkverifyjs";
import dotenv from "dotenv";
dotenv.config();

import fs from "fs";

const proof = JSON.parse(fs.readFileSync("./assets/risc0/proof.json")); // Following the Risc Zero tutorial

async function main() {
  const session = await zkVerifySession
    .start()
    .Volta()
    .withAccount(process.env.SEED_PHRASE);

  let statement, aggregationId;

  session.subscribe([
    {
      event: ZkVerifyEvents.NewAggregationReceipt,
      callback: async (eventData) => {
        console.log("New aggregation receipt:", eventData);
        if (
          aggregationId ==
          parseInt(eventData.data.aggregationId.replace(/,/g, ""))
        ) {
          let statementpath = await session.getAggregateStatementPath(
            eventData.blockHash,
            parseInt(eventData.data.domainId),
            parseInt(eventData.data.aggregationId.replace(/,/g, "")),
            statement
          );
          console.log("Statement path:", statementpath);
          const statementproof = {
            ...statementpath,
            domainId: parseInt(eventData.data.domainId),
            aggregationId: parseInt(
              eventData.data.aggregationId.replace(/,/g, "")
            ),
          };
          fs.writeFileSync("aggregation.json", JSON.stringify(statementproof));
        }
      },
      options: { domainId: 0 },
    },
  ]);

  const { events } = await session
    .verify()
    .risc0({ version: Risc0Version.V1_2 })
    .execute({
      proofData: {
        proof: proof.proof,
        vk: proof.image_id,
        publicSignals: proof.pub_inputs,
      },
      domainId: 0,
    });

  events.on(ZkVerifyEvents.IncludedInBlock, (eventData) => {
    console.log("Included in block", eventData);
    statement = eventData.statement;
    aggregationId = eventData.aggregationId;
  });
}

main();

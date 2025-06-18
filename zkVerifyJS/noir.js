import { zkVerifySession, ZkVerifyEvents } from "zkverifyjs";
import dotenv from "dotenv";
dotenv.config();

import fs from "fs";

const bufvk = fs.readFileSync("./assets/noir/vk");
const bufproof = fs.readFileSync("./assets/noir/proof");
const base64Proof = bufproof.toString("base64");
const base64Vk = bufvk.toString("base64");

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
    .ultraplonk({ numberOfPublicInputs: 1 })
    .execute({
      proofData: {
        vk: base64Vk,
        proof: base64Proof,
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

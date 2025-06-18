import axios from "axios";
import { NextApiRequest, NextApiResponse } from "next";
import { Buffer } from "buffer";

export default async function handler(req: NextApiRequest, res: NextApiResponse){
    
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    try{
        const API_URL = 'https://relayer-api.horizenlabs.io/api/v1';
        const vk = formatVk(req.body.vk);

        const params = {
            "proofType": "ultraplonk",
            "vkRegistered": false,
            "proofData": {
                "proof": req.body.proof,
                "publicSignals": JSON.parse(JSON.stringify(req.body.publicInputs)),
                "vk": vk
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
            if(jobStatusResponse.data.status === "IncludedInBlock"){
                console.log("Job Included in Block successfully");
                res.status(200).json(jobStatusResponse.data);
                return;
            }else{
                console.log("Job status: ", jobStatusResponse.data.status);
                console.log("Waiting for job to finalize...");
                await new Promise(resolve => setTimeout(resolve, 5000)); // Wait for 5 seconds before checking again
            }
        }
    }catch(error){
        console.log(error)
    }
}

export function formatVk(base64: string): string {
  const COMMITMENT_LABELS_ORDERED = [
    'ID_1',
    'ID_2',
    'ID_3',
    'ID_4',
    'Q_1',
    'Q_2',
    'Q_3',
    'Q_4',
    'Q_ARITHMETIC',
    'Q_AUX',
    'Q_C',
    'Q_ELLIPTIC',
    'Q_M',
    'Q_SORT',
    'SIGMA_1',
    'SIGMA_2',
    'SIGMA_3',
    'SIGMA_4',
    'TABLE_1',
    'TABLE_2',
    'TABLE_3',
    'TABLE_4',
    'TABLE_TYPE',
  ] as const;

  type CommitmentLabel = (typeof COMMITMENT_LABELS_ORDERED)[number];
  const COMMITMENT_LABELS = new Set<CommitmentLabel>(COMMITMENT_LABELS_ORDERED);

  interface G1Point {
    x: bigint;
    y: bigint;
  }

  interface VerificationKey {
    circuitType: number;
    circuitSize: number;
    numPublicInputs: number;
    commitments: Record<CommitmentLabel, G1Point>;
    containsRecursiveProof: boolean;
    recursiveProofIndices: number;
  }

  const readU32 = (view: DataView, offset: number): [number, number] => {
    return [view.getUint32(offset, false), offset + 4];
  };

  const readBool = (view: DataView, offset: number): [boolean, number] => {
    const val = view.getUint8(offset);
    if (val !== 0 && val !== 1) throw new Error(`Invalid bool value: ${val}`);
    return [val === 1, offset + 1];
  };

  const bytesToBigIntBE = (bytes: Uint8Array): bigint => {
    return BigInt('0x' + Buffer.from(bytes).toString('hex'));
  };

  const readG1Point = (view: DataView, offset: number): [G1Point, number] => {
    const xBytes = new Uint8Array(view.buffer, offset, 32);
    const yBytes = new Uint8Array(view.buffer, offset + 32, 32);
    return [
      { x: bytesToBigIntBE(xBytes), y: bytesToBigIntBE(yBytes) },
      offset + 64,
    ];
  };

  const readString = (
    view: DataView,
    offset: number,
    length: number,
  ): [string, number] => {
    const bytes = new Uint8Array(view.buffer, offset, length);
    return [new TextDecoder().decode(bytes), offset + length];
  };

  const bigintToU256Hex = (n: bigint): string =>
    n.toString(16).padStart(64, '0');

  const buffer = Buffer.from(base64, 'base64');
  const u8 = new Uint8Array(buffer);
  const view = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  let offset = 0;

  const [circuitType, o1] = readU32(view, offset);
  if (circuitType !== 2)
    throw new Error(`Invalid circuit type: ${circuitType}`);
  offset = o1;

  const [circuitSize, o2] = readU32(view, offset);
  if (!Number.isInteger(Math.log2(circuitSize))) {
    throw new Error(`Circuit size must be power of two: ${circuitSize}`);
  }
  offset = o2;

  const [numPublicInputs, o3] = readU32(view, offset);
  offset = o3;

  const [commitmentCount, o4] = readU32(view, offset);
  if (commitmentCount !== COMMITMENT_LABELS_ORDERED.length) {
    throw new Error(
      `Expected ${COMMITMENT_LABELS_ORDERED.length} commitments, got ${commitmentCount}`,
    );
  }
  offset = o4;

  const commitments = {} as Record<CommitmentLabel, G1Point>;

  for (let i = 0; i < commitmentCount; i++) {
    const [labelLength, offsetAfterLength] = readU32(view, offset);
    offset = offsetAfterLength;

    const [label, offsetAfterLabel] = readString(view, offset, labelLength);
    offset = offsetAfterLabel;

    if (!COMMITMENT_LABELS.has(label as CommitmentLabel)) {
      throw new Error(`Unexpected commitment label: ${label}`);
    }

    const [point, nextOffset] = readG1Point(view, offset);
    offset = nextOffset;
    commitments[label as CommitmentLabel] = point;
  }

  const [containsRecursiveProof, o5] = readBool(view, offset);
  if (containsRecursiveProof) throw new Error('Recursive proof not supported');
  offset = o5;

  offset += 4; // skip recursiveProofIndices
  const recursiveProofIndices = 0;

  const vk: VerificationKey = {
    circuitType,
    circuitSize,
    numPublicInputs,
    commitments,
    containsRecursiveProof,
    recursiveProofIndices,
  };

  const fields = [
    BigInt(vk.circuitType),
    BigInt(vk.circuitSize),
    BigInt(vk.numPublicInputs),
    ...COMMITMENT_LABELS_ORDERED.flatMap((label) => [
      vk.commitments[label].x,
      vk.commitments[label].y,
    ]),
    BigInt(vk.containsRecursiveProof ? 1 : 0),
    BigInt(vk.recursiveProofIndices),
  ];

  return '0x' + fields.map(bigintToU256Hex).join('');
}

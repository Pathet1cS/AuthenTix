import {
  UploadFile,
  toIpfsUri,
  uploadImageToIpfs,
  uploadJsonToIpfs,
} from '@/shared/utils/ipfs';

export interface EventMetadataInput {
  name: string;
  description: string;
  posterCID: string;
  eventDate: Date;
  saleDeadline: Date;
  ticketPrice: number;
  maxResalePrice: number;
  totalCapacity: number;
}

export interface Erc721Attribute {
  trait_type: string;
  value: string | number;
  display_type?: 'date';
}

export interface Erc721Metadata {
  name: string;
  description: string;
  image: string;
  attributes: Erc721Attribute[];
}

/** `display_type: "date"` is read as Unix seconds, not milliseconds. */
function toUnixSeconds(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}

export function buildEventMetadata(input: EventMetadataInput): Erc721Metadata {
  return {
    name: input.name,
    description: input.description,
    // The ipfs:// scheme keeps the token independent of any one gateway.
    image: toIpfsUri(input.posterCID),
    attributes: [
      { trait_type: 'Event Date', display_type: 'date', value: toUnixSeconds(input.eventDate) },
      {
        trait_type: 'Sale Deadline',
        display_type: 'date',
        value: toUnixSeconds(input.saleDeadline),
      },
      { trait_type: 'Ticket Price', value: input.ticketPrice },
      { trait_type: 'Max Resale Price', value: input.maxResalePrice },
      { trait_type: 'Total Capacity', value: input.totalCapacity },
    ],
  };
}

export interface EventAssets {
  posterCID: string;
  metadataCID: string;
}

/**
 * FR-03: poster to IPFS, then metadata JSON referencing it. Fail fast — if the
 * metadata upload fails the poster stays pinned and unreferenced, which costs a
 * few KB and avoids a cleanup path that could fail in turn.
 */
export async function uploadEventAssets(
  poster: UploadFile,
  event: Omit<EventMetadataInput, 'posterCID'>,
): Promise<EventAssets> {
  const posterCID = await uploadImageToIpfs(poster);
  const metadata = buildEventMetadata({ ...event, posterCID });
  const metadataCID = await uploadJsonToIpfs(metadata, 'metadata.json');

  return { posterCID, metadataCID };
}

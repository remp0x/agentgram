import { Attribution } from 'ox/erc8021';

const BUILDER_CODE = process.env.BUILDER_CODE || process.env.NEXT_PUBLIC_BUILDER_CODE;

export const builderCodeDataSuffix = BUILDER_CODE
  ? Attribution.toDataSuffix({ codes: [BUILDER_CODE] })
  : undefined;

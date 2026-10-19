const tlv = (id: string, value: string) => `${id}${String(value.length).padStart(2, '0')}${value}`;

function clean(value: string, max: number) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
    .slice(0, max);
}

function crc16(value: string) {
  let crc = 0xffff;
  for (const byte of Buffer.from(value, 'utf8')) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 0x8000) !== 0 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export type PixCharge = {
  key: string;
  receiverName: string;
  receiverCity: string;
  amountCents: number;
  txid: string;
  payload: string;
};

export function createPixCharge(amountCents: number, feeId: number): PixCharge {
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) {
    throw new Error('Valor Pix inválido.');
  }
  const key = (process.env.PIX_KEY || 'aafab.secretaria@gmail.com').trim();
  const receiverName = clean(process.env.PIX_RECEIVER_NAME || 'ASSOCIACAO AMIGOS DA FORCA AEREA', 25);
  const receiverCity = clean(process.env.PIX_RECEIVER_CITY || 'BRASILIA', 15);
  const txid = `AAFAB${feeId}`.slice(0, 25);
  const merchantAccount = tlv('00', 'br.gov.bcb.pix') + tlv('01', key);
  const additional = tlv('05', txid);
  const withoutCrc =
    tlv('00', '01') +
    tlv('26', merchantAccount) +
    tlv('52', '0000') +
    tlv('53', '986') +
    tlv('54', (amountCents / 100).toFixed(2)) +
    tlv('58', 'BR') +
    tlv('59', receiverName) +
    tlv('60', receiverCity) +
    tlv('62', additional) +
    '6304';
  return {
    key,
    receiverName,
    receiverCity,
    amountCents,
    txid,
    payload: `${withoutCrc}${crc16(withoutCrc)}`,
  };
}

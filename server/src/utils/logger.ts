export const auditLog = (action: string, details: string) => {
  const safeDetails = details.replace(/\b\d{11}\b/g, '[CPF OMITIDO]').slice(0, 500);
  console.info(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      type: 'AUDIT',
      action,
      details: safeDetails,
    }),
  );
};

ALTER TABLE "OfficeEntry" DROP CONSTRAINT "OfficeEntry_valid_kind";
ALTER TABLE "OfficeEntry" ADD CONSTRAINT "OfficeEntry_valid_kind"
  CHECK ("kind" IN ('ATENDIMENTO','SOLICITACAO','PENDENCIA','OBSERVACAO','ISENCAO'));

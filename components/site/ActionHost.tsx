"use client";

import React, { useCallback, useEffect, useState } from "react";
import LeadDialog from "@/components/market/LeadDialog";
import { PartnerDialog } from "./PartnerForm";
import { PARTNER_EVENT, REQUEST_EVENT } from "@/lib/actions";

/** Общие окна сайта: заявка экспортёра и анкета партнёра открываются там, где нажали кнопку */
export default function ActionHost() {
  const [open, setOpen] = useState<"request" | "partner" | null>(null);
  const close = useCallback(() => setOpen(null), []);

  useEffect(() => {
    const onRequest = () => setOpen("request");
    const onPartner = () => setOpen("partner");
    window.addEventListener(REQUEST_EVENT, onRequest);
    window.addEventListener(PARTNER_EVENT, onPartner);
    return () => {
      window.removeEventListener(REQUEST_EVENT, onRequest);
      window.removeEventListener(PARTNER_EVENT, onPartner);
    };
  }, []);

  if (open === "request") return <LeadDialog crop="flax" onClose={close} />;
  if (open === "partner") return <PartnerDialog onClose={close} />;
  return null;
}

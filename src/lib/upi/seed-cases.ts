// Deterministic seed data for PHALANX UPI demo workbench.
// Ground truth specs for Case A, Case B, Case C, and Failed-Payment test case.

import type {
  UpiCase,
  UpiCustomerRefundHistory,
  UpiInventoryItem,
  UpiOrder,
  ShiprocketTrackingData,
} from "./types";
import { allocateJurorPoints } from "./juror-math";

export const SEED_INVENTORY: UpiInventoryItem[] = [
  {
    sku: "SKU-AUDIO-ANC-01",
    product_name_en: "BharatRaksha BassPro ANC Wireless Headphones",
    product_name_hi: "भारत रक्षा बासप्रो एएनसी वायरलेस हेडफ़ोन",
    unit_price_paise: 320000, // ₹3,200
    unit_weight_kg: 0.85,
    stock_count: 140,
  },
  {
    sku: "SKU-SMARTWATCH-02",
    product_name_en: "BharatRaksha Apex Smartwatch (Titanium Grey)",
    product_name_hi: "भारत रक्षा एपेक्स स्मार्टवॉच (टाइटेनियम ग्रे)",
    unit_price_paise: 120000, // ₹1,200
    unit_weight_kg: 0.5,
    stock_count: 85,
  },
  {
    sku: "SKU-AUDIO-BAR-03",
    product_name_en: "BharatRaksha SoundBar 100W Dolby Atmos",
    product_name_hi: "भारत रक्षा साउंडबार 100W डॉल्बी एटमॉस",
    unit_price_paise: 249900, // ₹2,499
    unit_weight_kg: 2.1,
    stock_count: 42,
  },
];

export const SEED_CUSTOMERS: Record<string, UpiCustomerRefundHistory> = {
  "9820199482": {
    customer_phone: "9820199482",
    customer_name: "Rohan Sharma",
    total_orders: 6,
    refund_claims_count: 4,
    refund_ratio: 0.6667,
    prior_empty_box_flags: 2,
    risk_tier: "FLAGGED",
  },
  "9845102931": {
    customer_phone: "9845102931",
    customer_name: "Priya Patel",
    total_orders: 5,
    refund_claims_count: 0,
    refund_ratio: 0.0,
    prior_empty_box_flags: 0,
    risk_tier: "LOW",
  },
  "9811204859": {
    customer_phone: "9811204859",
    customer_name: "Amit Verma",
    total_orders: 3,
    refund_claims_count: 0,
    refund_ratio: 0.0,
    prior_empty_box_flags: 0,
    risk_tier: "LOW",
  },
  "9899112233": {
    customer_phone: "9899112233",
    customer_name: "Vikram Malhotra",
    total_orders: 2,
    refund_claims_count: 1,
    refund_ratio: 0.5,
    prior_empty_box_flags: 0,
    risk_tier: "MEDIUM",
  },
};

export const SEED_ORDERS: Record<string, UpiOrder> = {
  "ORD-KRY-8801": {
    order_id: "ORD-KRY-8801",
    customer_phone: "9820199482",
    customer_name: "Rohan Sharma",
    amount_paise: 320000,
    upi_rrn: "631514892011",
    razorpay_payment_id: "pay_UpiTestCaseA01",
    razorpay_order_id: "order_UpiOrderA01",
    payment_status: "captured",
    duplicate_payment_id: "pay_UpiTestCaseA02", // Failed ghost debit attempt
    awb_code: "AWB-SR-990101",
    warehouse_weight_kg: 0.85,
    courier_weight_kg: 0.85,
    otp_verified: true,
    created_at: "2026-11-05T14:20:00Z",
  },
  "ORD-KRY-8802": {
    order_id: "ORD-KRY-8802",
    customer_phone: "9845102931",
    customer_name: "Priya Patel",
    amount_paise: 120000,
    upi_rrn: "631518440293",
    razorpay_payment_id: "pay_UpiTestCaseB01",
    razorpay_order_id: "order_UpiOrderB01",
    payment_status: "captured",
    duplicate_payment_id: null,
    awb_code: "AWB-SR-990102",
    warehouse_weight_kg: 0.5,
    courier_weight_kg: 0.5,
    otp_verified: true,
    created_at: "2026-11-06T10:15:00Z",
  },
  "ORD-KRY-8803": {
    order_id: "ORD-KRY-8803",
    customer_phone: "9811204859",
    customer_name: "Amit Verma",
    amount_paise: 249900,
    upi_rrn: "631519773104",
    razorpay_payment_id: "pay_UpiTestCaseC01",
    razorpay_order_id: "order_UpiOrderC01",
    payment_status: "captured",
    duplicate_payment_id: null,
    awb_code: "AWB-SR-990103",
    warehouse_weight_kg: 2.1,
    courier_weight_kg: null,
    otp_verified: false,
    created_at: "2026-10-24T09:30:00Z",
  },
  "ORD-KRY-8804": {
    order_id: "ORD-KRY-8804",
    customer_phone: "9899112233",
    customer_name: "Vikram Malhotra",
    amount_paise: 150000,
    upi_rrn: "631510009988",
    razorpay_payment_id: "pay_UpiTestCaseD01",
    razorpay_order_id: "order_UpiOrderD01",
    payment_status: "failed", // Bank clearing failed, ₹0 settled
    duplicate_payment_id: null,
    awb_code: null,
    warehouse_weight_kg: null,
    courier_weight_kg: null,
    otp_verified: false,
    created_at: "2026-11-01T12:00:00Z",
  },
};

export const SEED_TRACKING: Record<string, ShiprocketTrackingData> = {
  "AWB-SR-990101": {
    track_status: 1,
    shipment_status: 7,
    shipment_track: [
      {
        id: 29184712,
        awb_code: "AWB-SR-990101",
        courier_company_id: 10,
        shipment_id: 8841201,
        order_id: "ORD-KRY-8801",
        pickup_date: "2026-11-05 14:20:00",
        delivered_date: "2026-11-08 16:42:10",
        weight: "0.85",
        packages: 1,
        current_status: "DELIVERED",
        delivered_to: "Buyer (OTP Verified: 4921)",
        destination: "Mumbai",
        consignee_name: "Rohan Sharma",
        origin: "Surat Warehouse",
        courier_agent_details: "Delhivery Surface",
      },
    ],
    shipment_track_activities: [
      {
        date: "2026-11-08 16:42:10",
        status: "DLVD",
        activity: "Delivered - OTP Verified at Doorstep (Weight: 0.85 kg)",
        location: "Mumbai_Andheri_East (Maharashtra)",
        "sr-status": "7",
        "sr-status-label": "DELIVERED",
      },
      {
        date: "2026-11-06 09:15:00",
        status: "IT",
        activity: "Bagged at Hub - Scanned Weight: 0.85 kg",
        location: "Bhiwandi_Hub (Maharashtra)",
        "sr-status": "18",
        "sr-status-label": "IN TRANSIT",
      },
      {
        date: "2026-11-05 16:30:00",
        status: "PU",
        activity: "Picked up from Surat Fulfillment Center - Scale Weight 0.85 kg",
        location: "Surat_Warehouse (Gujarat)",
        "sr-status": "13",
        "sr-status-label": "PICKED UP",
      },
    ],
    track_url: "https://shiprocket.co/tracking/AWB-SR-990101",
    etd: "2026-11-08 21:00:00",
  },
  "AWB-SR-990102": {
    track_status: 1,
    shipment_status: 7,
    shipment_track: [
      {
        id: 29184713,
        awb_code: "AWB-SR-990102",
        courier_company_id: 10,
        shipment_id: 8841202,
        order_id: "ORD-KRY-8802",
        pickup_date: "2026-11-06 10:15:00",
        delivered_date: "2026-11-09 11:20:00",
        weight: "0.50",
        packages: 1,
        current_status: "DELIVERED",
        delivered_to: "Buyer",
        destination: "Bengaluru",
        consignee_name: "Priya Patel",
        origin: "Surat Warehouse",
        courier_agent_details: "BlueDart Express",
      },
    ],
    shipment_track_activities: [
      {
        date: "2026-11-09 11:20:00",
        status: "DLVD",
        activity: "Delivered to consignee - Signature captured",
        location: "Bengaluru_Koramangala (Karnataka)",
        "sr-status": "7",
        "sr-status-label": "DELIVERED",
      },
      {
        date: "2026-11-07 14:00:00",
        status: "IT",
        activity: "In Transit - Hub Scanned 0.50 kg",
        location: "Bengaluru_Central (Karnataka)",
        "sr-status": "18",
        "sr-status-label": "IN TRANSIT",
      },
    ],
    track_url: "https://shiprocket.co/tracking/AWB-SR-990102",
    etd: "2026-11-09 18:00:00",
  },
  "AWB-SR-990103": {
    track_status: 1,
    shipment_status: 18,
    shipment_track: [
      {
        id: 29184714,
        awb_code: "AWB-SR-990103",
        courier_company_id: 14,
        shipment_id: 8841203,
        order_id: "ORD-KRY-8803",
        pickup_date: "2026-10-24 11:00:00",
        delivered_date: "",
        weight: "2.10",
        packages: 1,
        current_status: "LOST_IN_TRANSIT",
        delivered_to: "",
        destination: "Delhi",
        consignee_name: "Amit Verma",
        origin: "Surat Warehouse",
        courier_agent_details: "Shadowfax Logistics",
      },
    ],
    shipment_track_activities: [
      {
        date: "2026-10-26 04:12:00",
        status: "STUCK",
        activity: "Shipment untraceable at Bhiwandi sorting center - NDR: LOST_IN_TRANSIT_SUSPECTED",
        location: "Bhiwandi_Hub (Maharashtra)",
        "sr-status": "18",
        "sr-status-label": "LOST_IN_TRANSIT_SUSPECTED",
      },
      {
        date: "2026-10-24 16:30:00",
        status: "PU",
        activity: "Picked up from Warehouse - Weight 2.10 kg",
        location: "Surat_Warehouse (Gujarat)",
        "sr-status": "13",
        "sr-status-label": "PICKED UP",
      },
    ],
    track_url: "https://shiprocket.co/tracking/AWB-SR-990103",
    etd: "2026-10-28 20:00:00",
  },
};

export function getInitialSeedCases(): UpiCase[] {
  const [caseAPts1, caseAPts2, caseAPts3] = allocateJurorPoints(82, [35, 30, 17]);
  const [caseBPts1, caseBPts2, caseBPts3] = allocateJurorPoints(60, [35, 30, 5]);
  const [caseCPts1, caseCPts2, caseCPts3] = allocateJurorPoints(15, [35, 0, 0]);

  return [
    {
      case_id: "UPI-CASE-A",
      order_id: "ORD-KRY-8801",
      upi_rrn: "631514892011",
      claim_amount_paise: 320000, // ₹3,200
      recommended_refund_paise: 0,
      claim_type: "EMPTY_BOX",
      buyer_message_en:
        "₹3,200 debited twice from my GPay (RRN 631514892011) and the box delivered today was completely empty! Refund ₹3,200 immediately or I'm posting online!",
      buyer_message_hi:
        "मेरे जीपे से ₹3,200 दो बार कट गए (RRN 631514892011) और आज जो डिब्बा मिला वह पूरी तरह खाली था! मुझे तुरंत ₹3,200 वापस करो वरना मैं ऑनलाइन शिकायत करूँगा!",
      status: "REJECTED",
      verdict: "REJECT_CLAIM",
      score: 82, // Pass 1 was 65, Pass 2 Hound deep retrieval reached 82
      guardrail_state: "NO_REFUND_REJECTED_WITH_DOSSIER",
      requires_human_approval: false,
      human_approved_by: null,
      human_approved_at: null,
      razorpay_refund_id: null,
      reasoning_summary: {
        en: {
          verdict: "REJECT_CLAIM",
          reasons: [
            "Razorpay settlement verification confirms only 1 captured payment (pay_UpiTestCaseA01, ₹3,200); the second attempt (pay_UpiTestCaseA02) failed at bank clearing and never settled.",
            "Delhivery telemetry confirms doorstep OTP delivery (OTP 4921) with courier hub weight 0.85 kg exactly matching warehouse dispatch scale certificate (0.85 kg), disproving empty box claim.",
            "Customer has 4 refund claims across 6 previous orders (66.7% claim ratio) with 2 prior empty-box dispute flags.",
          ],
          namedGaps: [
            "MISSING_MERCHANT_LOG",
            "MISSING_DELIVERY_PROOF",
            "SPEC_MISMATCH_NAD",
          ],
        },
        hi: {
          verdict: "REJECT_CLAIM",
          reasons: [
            "रेज़रपे रिकॉर्ड पुष्टि करते हैं कि केवल १ भुगतान प्राप्त हुआ (₹3,200); दूसरा प्रयास बैंक स्तर पर विफल रहा और विक्रेता को राशि नहीं मिली।",
            "डिलीवरी टेलीमेट्री पुष्टि करती है कि पार्सल ओटीपी (4921) के साथ डिलीवर हुआ और कूरियर का वजन (0.85 किग्रा) वेयरहाउस वजन से हूबहू मेल खाता है, जिससे खाली डिब्बे का दावा झूठा सिद्ध होता है।",
            "ग्राहक के पिछले ६ में से ४ ऑर्डर पर रिफंड के दावे रहे हैं (६६.७% अनुपात) और २ बार खाली डिब्बे का झूठा आरोप लगाया गया है।",
          ],
          namedGaps: [
            "MISSING_MERCHANT_LOG",
            "MISSING_DELIVERY_PROOF",
            "SPEC_MISMATCH_NAD",
          ],
        },
      },
      juror_reports: [
        {
          jurorId: "JUROR_GATEWAY",
          jurorTitleEn: "Gateway & Settlement Juror",
          jurorTitleHi: "गेटवे एवं बैंक निपटान जूरी",
          scoreContribution: caseAPts1,
          critiqueEn:
            "Verified Razorpay ledger for RRN 631514892011: single captured payment of ₹3,200 (pay_UpiTestCaseA01). Second transaction pay_UpiTestCaseA02 timed out at NPCI and failed; merchant account received exactly ₹3,200 once. Zero duplicate captured funds.",
          critiqueHi:
            "आरआरएन 631514892011 के लिए रेज़रपे लेज़र की जांच की गई: केवल एक सफल भुगतान ₹3,200 (pay_UpiTestCaseA01)। दूसरा लेनदेन pay_UpiTestCaseA02 बैंक स्तर पर विफल हुआ; विक्रेता को केवल एक बार राशि प्राप्त हुई।",
          gapsIdentified: [],
          verdictRecommendation: "REJECT_CLAIM",
          source: "template",
          telemetrySummary: {
            captured_count: 1,
            failed_count: 1,
            captured_amount_paise: 320000,
          },
        },
        {
          jurorId: "JUROR_FULFILLMENT",
          jurorTitleEn: "Order & Logistics Telemetry Juror",
          jurorTitleHi: "वेयरहाउस एवं शिपिंग टेलीमेट्री जूरी",
          scoreContribution: caseAPts2,
          critiqueEn:
            "Shiprocket AWB-SR-990101 shows delivered on 2026-11-08 with doorstep OTP handshake (4921). Dispatch weight 0.85 kg matches Bhiwandi hub scan (0.85 kg) and delivery scan (0.85 kg). An empty box would weigh <0.15 kg.",
          critiqueHi:
            "शिपराकेट AWB-SR-990101 की ट्रैकिंग पुष्टि करती है कि पार्सल 2026-11-08 को ओटीपी (4921) के साथ प्राप्त हुआ। वजन 0.85 किग्रा प्रेषण और डिलीवरी दोनों समय समान था। खाली डिब्बे का वजन 0.15 किग्रा से कम होता।",
          gapsIdentified: ["SPEC_MISMATCH_NAD"],
          verdictRecommendation: "REJECT_CLAIM",
          source: "template",
          telemetrySummary: {
            awb: "AWB-SR-990101",
            status: "DELIVERED",
            otp_verified: true,
            weight_match: true,
          },
        },
        {
          jurorId: "JUROR_BUYER_RISK",
          jurorTitleEn: "Buyer History & Guardrail Juror",
          jurorTitleHi: "ग्राहक इतिहास एवं सुरक्षा सीमा जूरी",
          scoreContribution: caseAPts3,
          critiqueEn:
            "Buyer phone 9820199482 is classified FLAGGED (refund_ratio = 66.7%, 2 prior empty-box strikes). High risk repeat offender. Guardrail rejects refund without human override.",
          critiqueHi:
            "ग्राहक फोन 9820199482 संदिग्ध श्रेणी (FLAGGED) में दर्ज है (रिफंड दर 66.7%, 2 बार खाली डिब्बे का दावा)। सुरक्षा सीमा बिना ठोस कारण के रिफंड को अस्वीकार करती है।",
          gapsIdentified: ["MISSING_MERCHANT_LOG"],
          verdictRecommendation: "REJECT_CLAIM",
          source: "template",
          telemetrySummary: {
            risk_tier: "FLAGGED",
            refund_ratio: 0.6667,
          },
        },
      ],
      iteration_logs: [
        {
          iteration: 1,
          phase: "redteam_jury_v1",
          score: 65,
          verdict: "OFFER_PARTIAL",
          timestamp: "2026-11-08T17:00:00Z",
          actionTaken:
            "Pass 1 flagged missing warehouse scale certificate and unverified buyer OTP handshake.",
        },
        {
          iteration: 2,
          phase: "hound_deep_v2",
          score: 82,
          verdict: "REJECT_CLAIM",
          timestamp: "2026-11-08T17:01:15Z",
          actionTaken:
            "Hound re-fetched Surat warehouse packing station scale certificate (0.85 kg) and Delhivery electronic POD OTP log (4921). Score elevated to 82/100 -> REJECT_CLAIM.",
          retrievedArtifacts: [
            "WAREHOUSE_SCALE_CERT_085KG",
            "DELHIVERY_OTP_POD_4921",
          ],
        },
      ],
      created_at: "2026-11-08T16:55:00Z",
      updated_at: "2026-11-08T17:02:00Z",
      order_telemetry: SEED_ORDERS["ORD-KRY-8801"],
      buyer_telemetry: SEED_CUSTOMERS["9820199482"],
      tracking_telemetry: SEED_TRACKING["AWB-SR-990101"],
    },
    {
      case_id: "UPI-CASE-B",
      order_id: "ORD-KRY-8802",
      upi_rrn: "631518440293",
      claim_amount_paise: 120000, // ₹1,200
      recommended_refund_paise: 30000, // ₹300 (25% partial settlement)
      claim_type: "DAMAGED_ITEM",
      buyer_message_en:
        "Received my order ORD-KRY-8802 (RRN 631518440293) paid ₹1,200 via PhonePe, but there is a scratch on the side panel. I want a full ₹1,200 refund.",
      buyer_message_hi:
        "मुझे मेरा ऑर्डर ORD-KRY-8802 (RRN 631518440293) मिला, जिसका भुगतान मैंने फ़ोनपे से ₹1,200 किया था, लेकिन इसके साइड पैनल पर खरोंच है। मुझे पूरे ₹1,200 का रिफंड चाहिए।",
      status: "AWAITING_HUMAN_APPROVAL",
      verdict: "OFFER_PARTIAL",
      score: 60,
      guardrail_state: "LOCKED_AWAITING_HUMAN_APPROVAL",
      requires_human_approval: true,
      human_approved_by: null,
      human_approved_at: null,
      razorpay_refund_id: null,
      reasoning_summary: {
        en: {
          verdict: "OFFER_PARTIAL",
          reasons: [
            "Legitimate order and single captured payment verified (pay_UpiTestCaseB01, ₹1,200 via PhonePe).",
            "Customer photo inspection indicates minor cosmetic scuff on casing; primary electronic functions test 100% operational.",
            "Customer has exemplary loyalty record (5 completed orders, 0 prior disputes). Offering 25% de-escalation partial refund (₹300) awaiting merchant approval.",
          ],
          namedGaps: ["SPEC_MISMATCH_NAD"],
        },
        hi: {
          verdict: "OFFER_PARTIAL",
          reasons: [
            "वैध ऑर्डर एवं रेज़रपे पर ₹1,200 का सफल भुगतान सत्यापित (pay_UpiTestCaseB01)।",
            "ग्राहक द्वारा भेजे गए चित्र में केवल बाहरी आवरण पर मामूली खरोंच है; मुख्य उत्पाद पूरी तरह चालू स्थिति में है।",
            "ग्राहक का पिछला रिकॉर्ड उत्कृष्ट है (५ सफल ऑर्डर, शून्य विवाद)। सद्भावना में २५% आंशिक रिफंड (₹300) मर्चेंट स्वीकृति की प्रतीक्षा में।",
          ],
          namedGaps: ["SPEC_MISMATCH_NAD"],
        },
      },
      juror_reports: [
        {
          jurorId: "JUROR_GATEWAY",
          jurorTitleEn: "Gateway & Settlement Juror",
          jurorTitleHi: "गेटवे एवं बैंक निपटान जूरी",
          scoreContribution: caseBPts1,
          critiqueEn:
            "Verified Razorpay payment pay_UpiTestCaseB01 is CAPTURED for ₹1,200. Eligible for partial refund up to ₹1,200.",
          critiqueHi:
            "रेज़रपे भुगतान pay_UpiTestCaseB01 ₹1,200 हेतु सफलतापूर्वक कैप्चर किया गया है। आंशिक रिफंड हेतु पात्र।",
          gapsIdentified: [],
          verdictRecommendation: "OFFER_PARTIAL",
          source: "template",
          telemetrySummary: { captured: true, amount_paise: 120000 },
        },
        {
          jurorId: "JUROR_FULFILLMENT",
          jurorTitleEn: "Order & Logistics Telemetry Juror",
          jurorTitleHi: "वेयरहाउस एवं शिपिंग टेलीमेट्री जूरी",
          scoreContribution: caseBPts2,
          critiqueEn:
            "Shiprocket AWB-SR-990102 confirmed delivered. Buyer uploaded photo confirming product receipt with minor surface scratch on bezel.",
          critiqueHi:
            "शिपराकेट AWB-SR-990102 डिलीवर हो चुका है। ग्राहक के फोटो से मामूली खरोंच की पुष्टि होती है।",
          gapsIdentified: ["SPEC_MISMATCH_NAD"],
          verdictRecommendation: "OFFER_PARTIAL",
          source: "template",
          telemetrySummary: { awb: "AWB-SR-990102", status: "DELIVERED" },
        },
        {
          jurorId: "JUROR_BUYER_RISK",
          jurorTitleEn: "Buyer History & Guardrail Juror",
          jurorTitleHi: "ग्राहक इतिहास एवं सुरक्षा सीमा जूरी",
          scoreContribution: caseBPts3,
          critiqueEn:
            "Buyer Priya Patel has 0% refund ratio across 5 orders. Low risk loyal buyer. Recommended partial settlement ₹300 requires mandatory operator approval under default 0 auto-refund ceiling.",
          critiqueHi:
            "प्रिया पटेल का ५ ऑर्डर में शून्य रिफंड का रिकॉर्ड है। अनुशंसित आंशिक रिफंड ₹300 डिफ़ॉल्ट 0 ऑटो-रिफंड सीमा के तहत मर्चेंट स्वीकृति की प्रतीक्षा में है।",
          gapsIdentified: [],
          verdictRecommendation: "OFFER_PARTIAL",
          source: "template",
          telemetrySummary: { refund_ratio: 0.0, recommended_paise: 30000 },
        },
      ],
      iteration_logs: [
        {
          iteration: 1,
          phase: "arbiter_routing",
          score: 60,
          verdict: "OFFER_PARTIAL",
          timestamp: "2026-11-09T12:00:00Z",
          actionTaken:
            "Evaluated cosmetic damage claim -> recommended ₹300 partial refund. Guardrail locked awaiting human operator approval.",
        },
      ],
      created_at: "2026-11-09T11:45:00Z",
      updated_at: "2026-11-09T12:05:00Z",
      order_telemetry: SEED_ORDERS["ORD-KRY-8802"],
      buyer_telemetry: SEED_CUSTOMERS["9845102931"],
      tracking_telemetry: SEED_TRACKING["AWB-SR-990102"],
    },
    {
      case_id: "UPI-CASE-C",
      order_id: "ORD-KRY-8803",
      upi_rrn: "631519773104",
      claim_amount_paise: 249900, // ₹2,499
      recommended_refund_paise: 249900, // ₹2,499 full refund
      claim_type: "LOST_IN_TRANSIT",
      buyer_message_en:
        "Order ORD-KRY-8803, paid ₹2,499 via UPI (RRN 631519773104) 9 days ago. Tracking hasn't moved in a week. Please refund my ₹2,499.",
      buyer_message_hi:
        "ऑर्डर ORD-KRY-8803, मैंने ९ दिन पहले यूपीआई (RRN 631519773104) से ₹2,499 का भुगतान किया था। ट्रैकिंग एक सप्ताह से अटकी हुई है। कृपया मेरे ₹2,499 वापस करें।",
      status: "AWAITING_HUMAN_APPROVAL",
      verdict: "APPROVE_REFUND",
      score: 15,
      guardrail_state: "LOCKED_AWAITING_HUMAN_APPROVAL",
      requires_human_approval: true,
      human_approved_by: null,
      human_approved_at: null,
      razorpay_refund_id: null,
      reasoning_summary: {
        en: {
          verdict: "APPROVE_REFUND",
          reasons: [
            "Payment of ₹2,499 was captured successfully on 2026-10-24 via Razorpay (pay_UpiTestCaseC01).",
            "Shiprocket tracking AWB-SR-990103 has been stalled for 9 days at Bhiwandi sorting hub with courier remark 'LOST_IN_TRANSIT_SUSPECTED'.",
            "Buyer is entitled to a full ₹2,499 refund. Amount exceeds ₹500 guardrail threshold; human approval gate is LOCKED to prevent automated cash drainage.",
          ],
          namedGaps: ["MISSING_DELIVERY_PROOF", "MISSING_TRACKING"],
        },
        hi: {
          verdict: "APPROVE_REFUND",
          reasons: [
            "रेज़रपे के माध्यम से 2026-10-24 को ₹2,499 का भुगतान सफलतापूर्वक प्राप्त हुआ (pay_UpiTestCaseC01)।",
            "शिपराकेट ट्रैकिंग AWB-SR-990103 भिवंडी सॉर्टिंग हब पर पिछले ९ दिनों से अटकी है और कूरियर रिमार्क 'LOST_IN_TRANSIT_SUSPECTED' है।",
            "ग्राहक पूर्ण ₹2,499 रिफंड का हकदार है। राशि ₹500 सुरक्षा सीमा से अधिक है, अतः अनधिकृत फंड निकासी रोकने हेतु मानवीय स्वीकृति लॉक लागू है।",
          ],
          namedGaps: ["MISSING_DELIVERY_PROOF", "MISSING_TRACKING"],
        },
      },
      juror_reports: [
        {
          jurorId: "JUROR_GATEWAY",
          jurorTitleEn: "Gateway & Settlement Juror",
          jurorTitleHi: "गेटवे एवं बैंक निपटान जूरी",
          scoreContribution: caseCPts1,
          critiqueEn:
            "Verified Razorpay payment pay_UpiTestCaseC01 is CAPTURED for ₹2,499. Merchant holds the funds; refund is technically viable.",
          critiqueHi:
            "रेज़रपे भुगतान pay_UpiTestCaseC01 ₹2,499 कैप्चर स्थिति में है। राशि मर्चेंट खाते में उपलब्ध है।",
          gapsIdentified: [],
          verdictRecommendation: "APPROVE_REFUND",
          source: "template",
          telemetrySummary: { captured: true, amount_paise: 249900 },
        },
        {
          jurorId: "JUROR_FULFILLMENT",
          jurorTitleEn: "Order & Logistics Telemetry Juror",
          jurorTitleHi: "वेयरहाउस एवं शिपिंग टेलीमेट्री जूरी",
          scoreContribution: caseCPts2,
          critiqueEn:
            "Shiprocket AWB-SR-990103: zero movement for 9 days. Shadowfax status LOST_IN_TRANSIT_SUSPECTED. Delivery failure is confirmed on carrier end.",
          critiqueHi:
            "शिपराकेट AWB-SR-990103: पिछले ९ दिनों से कोई गतिविधि नहीं। कूरियर स्थिति 'LOST_IN_TRANSIT_SUSPECTED'। कूरियर स्तर पर डिलीवरी विफलता सिद्ध है।",
          gapsIdentified: ["MISSING_DELIVERY_PROOF", "MISSING_TRACKING"],
          verdictRecommendation: "APPROVE_REFUND",
          source: "template",
          telemetrySummary: { awb: "AWB-SR-990103", days_stalled: 9 },
        },
        {
          jurorId: "JUROR_BUYER_RISK",
          jurorTitleEn: "Buyer History & Guardrail Juror",
          jurorTitleHi: "ग्राहक इतिहास एवं सुरक्षा सीमा जूरी",
          scoreContribution: caseCPts3,
          critiqueEn:
            "Clean customer profile (3 orders, 0 disputes). Requested full refund is ₹2,499, which is >= ₹500. Guardrail enforces LOCKED_AWAITING_HUMAN_APPROVAL.",
          critiqueHi:
            "ग्राहक का साफ़ रिकॉर्ड (३ ऑर्डर, शून्य विवाद)। अनुशंसित रिफंड ₹2,499 है, जो ₹500 से अधिक है। सुरक्षा सीमा ने मानवीय स्वीकृति लॉक लागू किया है।",
          gapsIdentified: [],
          verdictRecommendation: "APPROVE_REFUND",
          source: "template",
          telemetrySummary: {
            amount_paise: 249900,
            threshold_paise: 50000,
            locked: true,
          },
        },
      ],
      iteration_logs: [
        {
          iteration: 1,
          phase: "arbiter_routing",
          score: 15,
          verdict: "APPROVE_REFUND",
          timestamp: "2026-11-02T09:00:00Z",
          actionTaken:
            "Lost in transit verified -> APPROVE_REFUND (₹2,499). Guardrail locked awaiting human operator approval.",
        },
      ],
      created_at: "2026-11-02T08:30:00Z",
      updated_at: "2026-11-02T09:00:00Z",
      order_telemetry: SEED_ORDERS["ORD-KRY-8803"],
      buyer_telemetry: SEED_CUSTOMERS["9811204859"],
      tracking_telemetry: SEED_TRACKING["AWB-SR-990103"],
    },
  ];
}


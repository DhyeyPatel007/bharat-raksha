import { NextRequest, NextResponse } from "next/server";
import { SEED_TRACKING } from "@/lib/upi/seed-cases";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ awb: string }> }
) {
  const { awb } = await params;
  const mock = SEED_TRACKING[awb];

  if (mock) {
    return NextResponse.json({ tracking_data: mock }, { status: 200 });
  }

  // Schema-exact fallback
  return NextResponse.json(
    {
      tracking_data: {
        track_status: 1,
        shipment_status: 7,
        shipment_track: [
          {
            id: 29184999,
            awb_code: awb,
            courier_company_id: 10,
            shipment_id: 8841999,
            order_id: "ORD-MOCK",
            pickup_date: "2026-11-01 10:00:00",
            delivered_date: "2026-11-04 14:00:00",
            weight: "1.00",
            packages: 1,
            current_status: "DELIVERED",
            delivered_to: "Buyer",
            destination: "India",
            consignee_name: "Customer",
            origin: "Central Warehouse",
            courier_agent_details: "Delhivery Surface",
          },
        ],
        shipment_track_activities: [
          {
            date: "2026-11-04 14:00:00",
            status: "DLVD",
            activity: "Delivered to consignee",
            location: "Destination",
            "sr-status": "7",
            "sr-status-label": "DELIVERED",
          },
        ],
        track_url: `https://shiprocket.co/tracking/${awb}`,
        etd: "2026-11-04 18:00:00",
      },
    },
    { status: 200 }
  );
}


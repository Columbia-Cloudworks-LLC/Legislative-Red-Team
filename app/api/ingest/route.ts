/**
 * Congress.gov API v3 Ingestion Route
 * 
 * This API route handles ingestion of bills from Congress.gov API v3.
 * API Documentation: https://api.congress.gov/
 * 
 * Required environment variables:
 * - CONGRESS_API_KEY: API key for Congress.gov API
 * - SUPABASE_URL: Supabase project URL
 * - SUPABASE_ANON_KEY: Supabase anonymous key
 */

import { NextRequest, NextResponse } from 'next/server';

// Congress.gov API v3 base URL
const CONGRESS_API_BASE = 'https://api.congress.gov/v3';

interface CongressBill {
  congress: number;
  type: string;
  number: number;
  title: string;
  updateDate: string;
}

interface CongressAPIResponse {
  bills?: CongressBill[];
  bill?: {
    congress: number;
    type: string;
    number: number;
    title: string;
    sponsors?: Array<{
      firstName: string;
      lastName: string;
    }>;
    introducedDate: string;
    latestAction?: {
      actionDate: string;
      text: string;
    };
    textVersions?: {
      url: string;
    };
  };
}

/**
 * GET handler - Fetch bills from Congress.gov API
 * 
 * Query parameters:
 * - congress: Congress number (e.g., 118)
 * - billType: Type of bill (hr, s, hjres, sjres, hconres, sconres, hres, sres)
 * - limit: Number of results to return (default: 20, max: 250)
 * - offset: Offset for pagination (default: 0)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const congress = searchParams.get('congress') || '118';
    const billType = searchParams.get('billType') || 'hr';
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Check for API key
    const apiKey = process.env.CONGRESS_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'CONGRESS_API_KEY not configured' },
        { status: 500 }
      );
    }

    // Construct API URL
    const url = `${CONGRESS_API_BASE}/bill/${congress}/${billType}?limit=${limit}&offset=${offset}&api_key=${apiKey}`;

    // Fetch from Congress.gov API
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Congress API error: ${response.status} ${response.statusText}`);
    }

    const data: CongressAPIResponse = await response.json();

    return NextResponse.json({
      success: true,
      data,
      pagination: {
        limit,
        offset,
        congress,
        billType,
      },
    });
  } catch (error) {
    console.error('Error fetching from Congress.gov:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch bills from Congress.gov',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST handler - Ingest a specific bill and store in Supabase
 * 
 * Request body:
 * {
 *   congress: number,
 *   billType: string,
 *   billNumber: number
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { congress, billType, billNumber } = body;

    if (!congress || !billType || !billNumber) {
      return NextResponse.json(
        { error: 'Missing required fields: congress, billType, billNumber' },
        { status: 400 }
      );
    }

    // Check for API key
    const apiKey = process.env.CONGRESS_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'CONGRESS_API_KEY not configured' },
        { status: 500 }
      );
    }

    // Fetch bill details
    const billUrl = `${CONGRESS_API_BASE}/bill/${congress}/${billType}/${billNumber}?api_key=${apiKey}`;
    const billResponse = await fetch(billUrl, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!billResponse.ok) {
      throw new Error(`Congress API error: ${billResponse.status}`);
    }

    const billData: CongressAPIResponse = await billResponse.json();
    const bill = billData.bill;

    if (!bill) {
      return NextResponse.json(
        { error: 'Bill not found' },
        { status: 404 }
      );
    }

    // Fetch bill text (XML version if available)
    // Stub: In full implementation, would fetch actual XML content from text versions URL
    // const billXml = bill.textVersions ? await fetchBillXml(bill.textVersions.url) : null;

    // Construct congress_id
    const congressId = `${congress}-${billType}-${billNumber}`;

    // Stub: Would insert into Supabase
    // const supabase = createClient(
    //   process.env.SUPABASE_URL!,
    //   process.env.SUPABASE_ANON_KEY!
    // );
    // 
    // await supabase.from('bills').upsert({
    //   congress_id: congressId,
    //   last_version_xml: null, // Would be billXml if fetched
    //   title: bill.title,
    //   sponsor: bill.sponsors?.[0] ? `${bill.sponsors[0].firstName} ${bill.sponsors[0].lastName}` : null,
    //   introduced_date: bill.introducedDate,
    //   status: bill.latestAction?.text || null,
    // });

    return NextResponse.json({
      success: true,
      message: 'Bill ingested successfully',
      congressId,
      bill: {
        congress: bill.congress,
        type: bill.type,
        number: bill.number,
        title: bill.title,
        sponsor: bill.sponsors?.[0] ? `${bill.sponsors[0].firstName} ${bill.sponsors[0].lastName}` : null,
        introducedDate: bill.introducedDate,
        status: bill.latestAction?.text,
      },
    });
  } catch (error) {
    console.error('Error ingesting bill:', error);
    return NextResponse.json(
      {
        error: 'Failed to ingest bill',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

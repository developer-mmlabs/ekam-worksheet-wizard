import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("schools")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(1)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const { id, name, location, primary_color, secondary_color, academic_year, logo_url } = body;

  const updates = {
    name,
    location,
    primary_color,
    secondary_color,
    academic_year,
    logo_url,
    updated_at: new Date().toISOString(),
  };

  if (id) {
    const { data, error } = await supabaseAdmin
      .from("schools")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data);
  } else {
    const { data, error } = await supabaseAdmin
      .from("schools")
      .insert(updates)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data);
  }
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file") as File;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const filePath = `logos/${Date.now()}-${file.name}`;
  const { error: uploadError } = await supabaseAdmin.storage
    .from("school-assets")
    .upload(filePath, file);

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: { publicUrl } } = supabaseAdmin.storage
    .from("school-assets")
    .getPublicUrl(filePath);

  return NextResponse.json({ publicUrl });
}

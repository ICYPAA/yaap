import { promises as fs } from "fs"
import { NextResponse } from "next/server"
import path from "path"

export async function GET() {
  try {
    // Path to the pkpass file relative to project root
    const pkpassPath = path.join(process.cwd(), "QRCode.pkpass")

    // Read the file
    const fileContent = await fs.readFile(pkpassPath)

    // Return the file with appropriate headers
    return new NextResponse(fileContent, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.apple.pkpass",
        "Content-Disposition": 'attachment; filename="ICYPAA.pkpass"'
      }
    })
  } catch (error) {
    console.error("Error serving pkpass file:", error)
    return NextResponse.json(
      { error: "Failed to serve pkpass file" },
      { status: 500 }
    )
  }
}

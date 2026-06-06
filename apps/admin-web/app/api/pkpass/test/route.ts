import { promises as fs } from "fs"
import { NextResponse } from "next/server"
import path from "path"

export async function GET() {
  try {
    // Path to the pkpass file relative to project root
    const pkpassPath = path.join(process.cwd(), "QRCode.pkpass")

    // Check if the file exists
    try {
      await fs.access(pkpassPath)
    } catch (error) {
      return NextResponse.json(
        {
          error: "pkpass file not found",
          path: pkpassPath
        },
        { status: 404 }
      )
    }

    // Get file stats
    const stats = await fs.stat(pkpassPath)

    // Return info about the file
    return NextResponse.json({
      exists: true,
      size: stats.size,
      isFile: stats.isFile(),
      created: stats.birthtime,
      modified: stats.mtime,
      path: pkpassPath,
      message: "The pkpass file is available and ready for download"
    })
  } catch (error) {
    console.error("Error checking pkpass file:", error)
    return NextResponse.json(
      { error: "Failed to check pkpass file", details: String(error) },
      { status: 500 }
    )
  }
}

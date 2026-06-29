'use client'

import { useState } from 'react'

export function ReportFilePicker() {
  const [fileName, setFileName] = useState<string | null>(null)

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label
        htmlFor="report-file"
        className="inline-block cursor-pointer rounded-lg bg-[#E0F4F2] px-3 py-2 text-sm font-medium text-gray-800 transition-colors hover:bg-[#c8ebe8] active:bg-[#b3e0dc]"
      >
        Choose file
      </label>
      <input
        id="report-file"
        type="file"
        name="file"
        accept=".pdf,image/*"
        required
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0]
          setFileName(file?.name ?? null)
        }}
      />
      <span className="text-sm text-gray-500">{fileName ?? 'No file chosen'}</span>
    </div>
  )
}

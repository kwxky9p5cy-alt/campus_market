import type { AutofillImage } from '@/services/ai/types'

const MAX_AI_IMAGE_DIMENSION = 1600
const MAX_AI_IMAGE_BYTES = 1_500_000
const JPEG_QUALITIES = [0.82, 0.68, 0.54]

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('读取图片失败，请重新选择。'))
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('图片格式无法读取。'))
    reader.readAsDataURL(blob)
  })
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('图片压缩失败，请换一张图片。')), 'image/jpeg', quality)
  })
}

async function drawToCanvas(file: File) {
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d', { alpha: false })
  if (!context) throw new Error('当前浏览器无法处理图片。')

  if ('createImageBitmap' in window) {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, MAX_AI_IMAGE_DIMENSION / Math.max(bitmap.width, bitmap.height))
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()
    return canvas
  }

  const objectUrl = URL.createObjectURL(file)
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image()
      element.onload = () => resolve(element)
      element.onerror = () => reject(new Error('图片解码失败，请换一张图片。'))
      element.src = objectUrl
    })
    const scale = Math.min(1, MAX_AI_IMAGE_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight))
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    return canvas
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

export async function prepareAutofillImages(files: File[]): Promise<AutofillImage[]> {
  const prepared: AutofillImage[] = []
  for (const file of files) {
    const canvas = await drawToCanvas(file)
    let blob: Blob | null = null
    for (const quality of JPEG_QUALITIES) {
      blob = await canvasToBlob(canvas, quality)
      if (blob.size <= MAX_AI_IMAGE_BYTES) break
    }
    if (!blob || blob.size > MAX_AI_IMAGE_BYTES) throw new Error(`“${file.name}”压缩后仍然过大，请裁剪后重试。`)
    prepared.push({ name: file.name, url: await blobToDataUrl(blob) })
  }
  return prepared
}

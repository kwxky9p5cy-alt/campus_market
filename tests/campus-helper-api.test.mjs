import { describe, expect, it } from 'vitest'
import { extractStreamAnswer } from '../api/campus-helper.mjs'

describe('campus helper SSE response', () => {
  it('joins answer fragments and ignores other events', () => {
    const body = [
      'event: message',
      'data: {"type":"message_start","content":{"answer":null}}',
      '',
      'event: message',
      'data: {"type":"answer","content":{"answer":"标准"}}',
      '',
      'event: message',
      'data: {"type":"answer","content":{"answer":"接口"}}',
      '',
      'event: message',
      'data: {"type":"message_end","content":{"answer":null}}',
    ].join('\n')

    expect(extractStreamAnswer(body)).toBe('标准接口')
  })

  it('ignores malformed SSE data', () => {
    expect(extractStreamAnswer('data: heartbeat\ndata: [DONE]')).toBe('')
  })
})

import { describe, it, expect, beforeEach } from 'vitest'
import { ReminderScheduler } from '../src/utils/ReminderScheduler'

describe('ReminderScheduler', () => {
  let scheduler: ReminderScheduler

  beforeEach(() => {
    scheduler = new ReminderScheduler()
  })

  it('should initialize with default reminders', () => {
    const reminders = scheduler.getReminders()
    expect(reminders.length).toBeGreaterThan(0)
  })

  it('should not generate events when disabled', () => {
    scheduler.setEnabled(false)
    const events = scheduler.advance(3600)
    expect(events).toHaveLength(0)
  })

  it('should add custom reminder', () => {
    scheduler.setReminder({
      id: 'test',
      type: 'custom',
      intervalMinutes: 1,
      message: 'Test reminder',
      enabled: true
    })

    const reminders = scheduler.getReminders()
    expect(reminders.some(r => r.id === 'test')).toBe(true)
  })

  it('should generate reminder events at intervals', () => {
    scheduler.setReminder({
      id: 'test',
      type: 'custom',
      intervalMinutes: 1,
      message: 'Test reminder',
      enabled: true,
      workingHoursOnly: false
    })

    const events = scheduler.advance(61)
    expect(events.some(e => e.id === 'test')).toBe(true)
  })

  it('should remove reminder', () => {
    scheduler.setReminder({
      id: 'test',
      type: 'custom',
      intervalMinutes: 1,
      message: 'Test reminder',
      enabled: true
    })

    scheduler.removeReminder('test')
    const reminders = scheduler.getReminders()
    expect(reminders.some(r => r.id === 'test')).toBe(false)
  })

  it('should snooze reminder', () => {
    scheduler.setReminder({
      id: 'test',
      type: 'custom',
      intervalMinutes: 1,
      message: 'Test reminder',
      enabled: true,
      workingHoursOnly: false
    })

    scheduler.advance(61)
    scheduler.snooze('test', 1)

    let events = scheduler.advance(30)
    expect(events.some(e => e.id === 'test')).toBe(false)

    events = scheduler.advance(35)
    expect(events.some(e => e.id === 'test')).toBe(true)
  })

  it('should reset all timers', () => {
    scheduler.setReminder({
      id: 'test',
      type: 'custom',
      intervalMinutes: 1,
      message: 'Test reminder',
      enabled: true,
      workingHoursOnly: false
    })

    scheduler.advance(30)
    scheduler.reset()
    const events = scheduler.advance(30)
    expect(events).toHaveLength(0)
  })
})

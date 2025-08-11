import styles from '../../app/page.module.css'

describe('CSS Modules', () => {
  test('exports valid CSS class names', () => {
    expect(typeof styles.container).toBe('string')
    expect(typeof styles.header).toBe('string')
    expect(typeof styles.title).toBe('string')
    expect(typeof styles.description).toBe('string')
    expect(typeof styles.modesContainer).toBe('string')
    expect(typeof styles.modeCard).toBe('string')
    expect(typeof styles.modeTitle).toBe('string')
    expect(typeof styles.modeDescription).toBe('string')
    expect(typeof styles.navigation).toBe('string')
    expect(typeof styles.navLink).toBe('string')
  })

  test('CSS class names are not empty', () => {
    Object.values(styles).forEach(className => {
      expect(className).toBeTruthy()
      expect(typeof className).toBe('string')
    })
  })
}) 
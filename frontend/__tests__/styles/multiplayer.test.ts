import styles from '../../app/multiplayer/multiplayer.module.css'

describe('Multiplayer CSS Modules', () => {
  test('exports valid CSS class names', () => {
    expect(typeof styles.container).toBe('string')
    expect(typeof styles.header).toBe('string')
    expect(typeof styles.lobby).toBe('string')
    expect(typeof styles.gameRoom).toBe('string')
    expect(typeof styles.playerBoard).toBe('string')
    expect(typeof styles.tile).toBe('string')
    expect(typeof styles.row).toBe('string')
    expect(typeof styles.keyboard).toBe('string')
    expect(typeof styles.key).toBe('string')
    expect(typeof styles.guessInput).toBe('string')
    expect(typeof styles.submitButton).toBe('string')
    expect(typeof styles.readyForNextRound).toBe('string')
    expect(typeof styles.readyButton).toBe('string')
  })

  test('CSS class names are not empty', () => {
    Object.values(styles).forEach(className => {
      expect(className).toBeTruthy()
      expect(typeof className).toBe('string')
    })
  })
}) 
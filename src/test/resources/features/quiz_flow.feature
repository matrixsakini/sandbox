Feature: Quiz flow
  Players start a quiz, answer questions, and compete on the leaderboard.

  Scenario: Player completes a quiz with all correct answers and appears on the leaderboard
    When "alice" starts a quiz on topic "e2e"
    Then the quiz is "IN_PROGRESS" with 2 questions remaining
    When all questions are answered correctly
    Then the quiz is "COMPLETED" with a score of 30
    And "alice" appears in the leaderboard for topic "e2e"

  Scenario: Wrong answers score zero points and quiz still completes
    When "bob" starts a quiz on topic "e2e"
    When all questions are answered incorrectly
    Then the quiz is "COMPLETED" with a score of 0

  Scenario: Player can retrieve an in-progress session by ID
    When "carol" starts a quiz on topic "e2e"
    Then fetching the session returns status "IN_PROGRESS"
    And the current question has 4 options
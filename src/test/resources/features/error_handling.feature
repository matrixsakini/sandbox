Feature: Error handling
  The API returns appropriate Problem Detail errors for invalid requests.

  Scenario: Starting a quiz on an unknown topic returns 400
    When a quiz is started on unknown topic "dragons"
    Then the response status is 400

  Scenario: Fetching an unknown session returns 404
    When session "00000000-0000-0000-0000-000000000000" is fetched
    Then the response status is 404

  Scenario: Submitting a duplicate answer returns 400
    Given "dave" has started a quiz on topic "e2e"
    When the current question is answered twice
    Then the response status is 400
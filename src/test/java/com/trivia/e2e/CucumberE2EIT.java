package com.trivia.e2e;

import io.cucumber.junit.platform.engine.Constants;
import org.junit.platform.suite.api.ConfigurationParameter;
import org.junit.platform.suite.api.IncludeEngines;
import org.junit.platform.suite.api.SelectClasspathResource;
import org.junit.platform.suite.api.Suite;

/**
 * Runs all Cucumber E2E scenarios via the JUnit Platform.
 * Activated by the 'integration' Maven profile: mvn verify -P integration
 */
@Suite
@IncludeEngines("cucumber")
@SelectClasspathResource("features")
@ConfigurationParameter(key = Constants.GLUE_PROPERTY_NAME, value = "com.trivia.e2e")
@ConfigurationParameter(key = Constants.PLUGIN_PROPERTY_NAME, value = "pretty,summary")
public class CucumberE2EIT {}
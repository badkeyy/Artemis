package de.tum.cit.aet.artemis.programming.theia;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.actuate.info.Info;

import de.tum.cit.aet.artemis.core.config.Constants;
import de.tum.cit.aet.artemis.core.config.TheiaInfoContributor;

class TheiaInfoContributorTest {

    @Value("${theia.portal-url}")
    private String expectedValue;

    TheiaInfoContributor theiaInfoContributor;

    @Test
    void testContribute() {
        Info.Builder builder = new Info.Builder();
        theiaInfoContributor = new TheiaInfoContributor();
        theiaInfoContributor.contribute(builder);

        Info info = builder.build();
        assertThat(info.getDetails().get(Constants.THEIA_PORTAL_URL)).isEqualTo(expectedValue);
    }
}

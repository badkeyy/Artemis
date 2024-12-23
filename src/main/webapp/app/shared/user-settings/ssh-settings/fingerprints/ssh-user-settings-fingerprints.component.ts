import { Component, OnInit, inject } from '@angular/core';
import { ButtonSize, ButtonType } from 'app/shared/components/button.component';
import { DocumentationType } from 'app/shared/components/documentation-button/documentation-button.component';
import { SshUserSettingsFingerprintsService } from 'app/shared/user-settings/ssh-settings/fingerprints/ssh-user-settings-fingerprints.service';

@Component({
    selector: 'jhi-account-information',
    templateUrl: './ssh-user-settings-fingerprints.component.html',
    styleUrls: ['./ssh-user-settings-fingerprints.component.scss', '../ssh-user-settings.component.scss'],
})
export class SshUserSettingsFingerprintsComponent implements OnInit {
    readonly sshUserSettingsService = inject(SshUserSettingsFingerprintsService);

    protected sshFingerprints?: { [key: string]: string };

    readonly documentationType: DocumentationType = 'SshSetup';
    protected readonly ButtonType = ButtonType;

    protected readonly ButtonSize = ButtonSize;

    async ngOnInit() {
        this.sshFingerprints = await this.sshUserSettingsService.getSshFingerprints();
    }
}

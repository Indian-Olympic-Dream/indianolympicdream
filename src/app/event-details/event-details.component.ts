import { Component, OnInit, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatMiniFabButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { NgFor, NgIf, DatePipe } from '@angular/common';
import { PayloadService } from '../services/payload.service';
@Component({
    selector: 'app-event-details',
    templateUrl: './event-details.component.html',
    styleUrls: ['./event-details.component.scss'],
    imports: [
        MatMiniFabButton,
        MatIcon,
        NgFor,
        NgIf,
        DatePipe,
    ],
})
export class EventDetailsComponent implements OnInit {
  sportPictogramUrl = 'assets/images/placeholder.svg';

  constructor(
    public dialogRef: MatDialogRef<EventDetailsComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private payload: PayloadService,
  ) { }

  ngOnInit(): void {
    this.sportPictogramUrl =
      this.payload.getSportPictogramUrl({
        sportSlug: this.toSlug(this.data?.sportname || ''),
        sportName: this.data?.sportname || '',
        includePlaceholderFallback: true,
      }) || this.payload.FALLBACK_SPORT_PICTOGRAM;
  }
  close(): void {
    this.dialogRef.close();
  }

  private toSlug(value: string): string {
    if (!value) return '';
    return value
      .trim()
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase();
  }
}

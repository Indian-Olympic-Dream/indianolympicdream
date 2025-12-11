import { Pipe, PipeTransform } from "@angular/core";

@Pipe({
  name: "formatDuration",
  standalone: true,
})
export class FormatDurationPipe implements PipeTransform {
  transform(value: number): string {
    if (isNaN(value) || value === null) {
      return "";
    }

    if (value >= 3600) {
      const hours = Math.floor(value / 3600);
      const minutes = Math.floor((value % 3600) / 60);
      const seconds = Math.floor(value % 60);

      const formattedHours = hours.toString().padStart(2, "0");
      const formattedMinutes = minutes.toString().padStart(2, "0");
      const formattedSeconds = seconds.toString().padStart(2, "0");

      return `${formattedHours}:${formattedMinutes}:${formattedSeconds}`;
    } else {
      const minutes = Math.floor(value / 60);
      const seconds = Math.floor(value % 60);

      const formattedMinutes = minutes.toString().padStart(2, "0");
      const formattedSeconds = seconds.toString().padStart(2, "0");

      return `${formattedMinutes}:${formattedSeconds}`;
    }
  }
}

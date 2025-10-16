import { Component, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatList, MatListModule } from '@angular/material/list';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatExpansionModule } from '@angular/material/expansion';
// --- JSON Data Structure Interfaces ---
interface CriteriaDetail {
  id: string;
  title: string;
  subtitle: string;
  details: string;
  icon: string;
}

interface PerformanceCutoff {
  participatingCountries: string;
  positionRequired: string;
}

interface PolicyDefinition {
  id: string;
  title: string;
  details: string;
  icon: string;
}

interface SelectionCriteriaJSON {
  header: { title: string; subtitle: string; };
  coreObjective: string;
  mainCriteria: CriteriaDetail[];
  lowParticipationCutoffs: { title: string; description: string; table: PerformanceCutoff[]; };
  summaryPoints: { icon: string; title: string; details: string; }[];
  policyDefinitions: PolicyDefinition[];
  externalLink: { text: string; url: string; };
}

const mockCriteriaData: SelectionCriteriaJSON = {
  "header": {
    "title": "Indian Contingent Selection Criteria (2026)",
    "subtitle": "Ministry of Youth Affairs & Sports, Govt. of India (Dated: 24.09.2025)"
  },
  "coreObjective": "The aim is to ensure that only the athletes who have a **real chance of winning a medal** are considered for participation in multi-disciplinary sports events.",
  "mainCriteria": [
    {
      "id": "individual_measurable",
      "title": "Measurable Individual Sports",
      "subtitle": "Benchmark: 6th Place Performance",
      "details": "Athlete must have matched or bettered the **6th-place performance** from the **last Asian Games** or **Senior Asian Championships** (if AG not contested) in an official competition held within the **12 months** preceding the upcoming Games.",
      "icon": "track_changes"
    },
    {
      "id": "individual_nonmeasurable",
      "title": "Non-Measurable Individual Sports",
      "subtitle": "Benchmark: 6th Place Finish / Top 6 Asian Rank",
      "details": "Athlete must achieve a **6th or better finish** in the last Senior Asian Championships (held within 12 months) OR World ranking must be amongst the **Top 6 Asian nations** (as of 10 days before submission).",
      "icon": "person_pin"
    },
    {
      "id": "team_sports",
      "title": "Team Sports & Events",
      "subtitle": "Benchmark: Top 8 Finish / Top 8 Asian Rank",
      "details": "Team must achieve a **Top 8 finish** in the last Senior Asian Championships (held within 12 months) OR be ranked within the **Top 8 among Asian countries** in international rankings (as of 10 days before submission).",
      "icon": "group"
    },
    {
      "id": "relaxation_clause",
      "title": "Relaxation Clause",
      "subtitle": "Consideration for Special Cases",
      "details": "Participation may be recommended in relaxation of criteria by experts of specific sports disciplines and SAI, provided there are **justifiable reasons** for the exception. The same will be considered by the Ministry for appropriate decision.",
      "icon": "handshake"
    },
    {
      "id": "contingent_cost",
      "title": "Contingent Size and Costs",
      "subtitle": "Strict Cost Clearance Mandatory",
      "details": "Only sportspersons, coaches, and support staff whose names have been cleared **at cost to the government** will be part of the contingent. No additional personnel will be included even at no cost to the government.",
      "icon": "gavel"
    },
    {
      "id": "rejection_clause",
      "title": "Rejection Clause",
      "subtitle": "Aiming for Participation vs. Excellence",
      "details": "Names will not be approved if the aim is solely **participation** and not **medal winning**, or if Asian Championships are held irregularly/competition standard is low to circumvent rules.",
      "icon": "do_not_disturb"
    }
  ],
  "lowParticipationCutoffs": {
    "title": "Low Participation Event Cutoffs",
    "description": "If the number of competing Asian countries is low in an event at the Asian Championships, the required position for eligibility is raised:",
    "table": [
      { "participatingCountries": "6-12 (in an event)", "positionRequired": "Top 4" },
      { "participatingCountries": "Less than 6 (in an event)", "positionRequired": "Top 2" }
    ]
  },
  "summaryPoints": [
    { "icon": "star", "title": "Medal Focus", "details": "Mandatory 'real chance of winning a medal'." },
    { "icon": "schedule", "title": "Time Bound", "details": "Performance must be achieved within the 12 months preceding Games." },
    { "icon": "handshake", "title": "Relaxation", "details": "Possible only with justifiable reasons from experts and SAI." }
  ],
  "policyDefinitions": [
    {
      "id": "ranking_validity",
      "title": "International Ranking Validity",
      "details": "Rankings are considered regularly promulgated if they are updated with a frequency of **at least once per month** by the recognised international federation.",
      "icon": "auto_schedule"
    },
    {
      "id": "asian_championships_validity",
      "title": "Asian Championships Eligibility Window",
      "details": "The most recent edition held within **12 months** prior to the Games is preferred. If none, the edition within the preceding **24 months** may be considered. Beyond 24 months is **not eligible**.",
      "icon": "event_note"
    },
    {
      "id": "equivalent_competition",
      "title": "Equivalent International Competitions",
      "details": "Must be recognized, conducted regularly for a minimum of **4 years**, and. recorded participation from at least **12 Asian countries** in the last two editions. **Invitational competitions are not considered**.",
      "icon": "leaderboard"
    }
  ],
  "externalLink": {
    "text": "View Full Policy Document (No. 70-9/2025-Governance-I)",
    "url": "https://yas.gov.in/sites/default/files/Letter%2024.09.2025%20Selection%20Criteria%20for%20Participation%20in%20the%202026%20Asian%20Games%2C%20Para-Asian%20Games%202026%20and%20other%20multi-sports%20events.pdf"
  }
};

@Component({
  selector: 'app-selection-policy',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule, MatListModule, MatExpansionModule],
  templateUrl: './selection-policy.component.html',
  styleUrl: './selection-policy.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SelectionPolicyComponent {
  criteria = signal<SelectionCriteriaJSON>(mockCriteriaData);
}